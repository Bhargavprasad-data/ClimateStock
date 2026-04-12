require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'climatestock_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

pool.connect()
  .then(async () => {
    console.log('✅ Connected to PostgreSQL Database successfully!');
    await autoInitializeDB();
  })
  .catch(err => console.error('❌ PostgreSQL Database connection error:', err.message));

async function autoInitializeDB() {
  try {
    // 1. Check if tables exist by querying information_schema
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'companies'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('🔄 Tables missing. Initializing schema from init_db.sql...');
      const sqlPath = path.join(__dirname, 'init_db.sql');
      const sqlSchema = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sqlSchema);
      console.log('✅ Schema created successfully.');
    }

    // 2. Check if data exists
    const dataCheck = await pool.query('SELECT COUNT(*) FROM stock_data');
    if (parseInt(dataCheck.rows[0].count) === 0) {
      console.log('📂 Database empty. Seeding from final_processed_data .csv...');
      await seedFromCSV();
    } else {
      console.log('✔ Database already contains data. Skipping seed.');
    }
  } catch (err) {
    console.error('❌ Database Initialization Error:', err.message);
  }
}

async function seedFromCSV() {
  try {
    const csvPath = path.join(__dirname, '..', 'final_processed_data .csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',');
    const dateIdx = headers.indexOf('Date');
    const closeIdx = headers.indexOf('CLOSE');
    const stockIdx = headers.indexOf('Stock');
    const tempIdx = headers.indexOf('Temperature');
    const heatwaveIdx = headers.indexOf('Heatwave');

    console.log('⌛ Inserting records (this may take a minute)...');
    
    await pool.query('BEGIN');
    const companyCache = {};
    let processed = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;

      const dateRaw = parts[dateIdx];
      const closeRaw = parseFloat(parts[closeIdx]) || 0;
      const stockRaw = parts[stockIdx]?.trim();
      const tempRaw = parseFloat(parts[tempIdx]) || 0;
      const hwRaw = parseInt(parts[heatwaveIdx]) === 1;

      if (!stockRaw) continue;

      let compId = companyCache[stockRaw];
      if (!compId) {
        const compRes = await pool.query(
          `INSERT INTO companies (name, symbol, sector) VALUES ($1, $2, 'Energy') 
           ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [stockRaw, stockRaw]
        );
        compId = compRes.rows[0].id;
        companyCache[stockRaw] = compId;
      }

      await pool.query(
        `INSERT INTO temperature_data (date, region, avg_temperature, heatwave_flag) 
         VALUES ($1, 'Unknown', $2, $3) ON CONFLICT DO NOTHING`,
        [dateRaw, tempRaw, hwRaw]
      );

      await pool.query(
        `INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume) 
         VALUES ($1, $2, $3, $3, $3, $3, 0) ON CONFLICT DO NOTHING`,
        [compId, dateRaw, closeRaw]
      );

      processed++;
      if (processed % 2000 === 0) console.log(`...inserted ${processed} rows`);
    }

    await pool.query('COMMIT');
    console.log(`✅ Successfully seeded ${processed} records!`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ CSV Seed Error:', err.message);
  }
}

let isDbInitialized = false;
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await autoInitializeDB();
      isDbInitialized = true;
    } catch (e) {
      console.error("Delayed Init Error:", e);
    }
  }
  next();
});

const BASE_PRICE = 450.00; // Baseline for trend calculation
const START_TIME = Date.now(); // Used for real-time dataset simulation offsets

// Fetch companies
app.get('/api/stocks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

app.get('/api/temperature', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM temperature_data ORDER BY date DESC LIMIT 30');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch temperature data' });
  }
});

// Fetch combined dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    // Implement time-based offset streaming (shifts 1 record right every 8 seconds)
    const elapsedSeconds = Math.floor((Date.now() - START_TIME) / 8000);
    const offset = elapsedSeconds % 9000; // Prevent out of bounds over 10k rows

    const tempResult = await pool.query(`SELECT * FROM temperature_data ORDER BY date ASC LIMIT 30 OFFSET ${offset}`);
    const stockResult = await pool.query(`SELECT * FROM stock_data WHERE company_id = 1 ORDER BY date ASC LIMIT 30 OFFSET ${offset}`);
    
    // Values are now fetched sequentially slicing forward
    const tempRows = tempResult.rows;
    const stockRows = stockResult.rows;

    // Merge by index synchronously to guarantee latest sequence charts
    const combined = tempRows.map((tRow, i) => {
      const sRow = stockRows[i];
      return {
        date: new Date(tRow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        temperature: parseFloat(tRow.avg_temperature),
        heatwave_flag: tRow.heatwave_flag,
        stockPrice: sRow ? parseFloat(sRow.close_price) : null,
      }
    });

    res.json(combined);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Predict API
app.post('/api/predict', async (req, res) => {
  const { temperature, heatwave_flag, company_id } = req.body;

  if (!temperature) {
    return res.status(400).json({ error: 'Temperature is required' });
  }

  let basePrice = 635.00;
  let ma_5 = 635.00;
  let lag1 = 0.0, lag3 = 0.0, lag5 = 0.0;
  if (company_id) {
    try {
      const priceQ = await pool.query(`SELECT close_price FROM stock_data WHERE company_id = $1 ORDER BY date DESC LIMIT 6`, [company_id]);
      if (priceQ.rows.length >= 6) {
         const p0 = parseFloat(priceQ.rows[0].close_price);
         const p1 = parseFloat(priceQ.rows[1].close_price);
         const p3 = parseFloat(priceQ.rows[3].close_price);
         const p5 = parseFloat(priceQ.rows[5].close_price);
         
         basePrice = p0;
         const sum = priceQ.rows.slice(0, 5).reduce((acc, row) => acc + parseFloat(row.close_price), 0);
         ma_5 = sum / 5;
         
         lag1 = (p0 - p1) / p1;
         lag3 = (p0 - p3) / p3;
         lag5 = (p0 - p5) / p5;
      } else if (priceQ.rows.length > 0) {
         basePrice = parseFloat(priceQ.rows[0].close_price);
         const sum = priceQ.rows.reduce((acc, row) => acc + parseFloat(row.close_price), 0);
         ma_5 = sum / priceQ.rows.length;
      }
    } catch(e) {
      console.error("Failed to map fallback prices:", e);
    }
  }

  const payload = JSON.stringify({
    temperature: parseFloat(temperature),
    heatwave_flag: heatwave_flag ? 1 : 0,
    ma_5: ma_5,
    lag1: lag1,
    lag3: lag3,
    lag5: lag5
  });

  // Call Python script
  const scriptPath = path.join(__dirname, 'predict.py');
  
  // Important: ensure python is in PATH or specify python3
  const escapedPayload = payload.replace(/"/g, '\\"');
  const command = `python "${scriptPath}" "${escapedPayload}"`;
  
  exec(command, async (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Prediction script failed', details: stderr });
    }

    try {
      // The python script should print a JSON response
      const output = JSON.parse(stdout);
      
      if (!output.success) {
        return res.status(500).json({ error: 'Failed inside python script', details: output.error });
      }

      const predictedPrice = output.prediction;
      
      let trend = 'Neutral';
      if (predictedPrice > basePrice * 1.01) trend = 'Bullish';
      else if (predictedPrice < basePrice * 0.99) trend = 'Bearish';

      // Generate simulated dynamic ML confidence natively
      let conf = 92.5 - Math.abs(30 - parseFloat(temperature)) * 1.5;
      if (heatwave_flag) conf -= 25.0; // Anomalous drops to Orange bounds
      if (Math.abs(predictedPrice - basePrice) > basePrice * 0.20) conf -= 30.0; // Extreme anomaly limits to Red bounds
      conf = Math.max(10.0, Math.min(99.9, conf));

      // Ensure we ALWAYS insert the prediction to log it for Insights
      const finalCid = company_id ? parseInt(company_id) : 1;
      
      await pool.query(
        `INSERT INTO predictions (company_id, date, input_temperature, predicted_price, predicted_trend, confidence_score)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
        [finalCid, temperature, predictedPrice, trend, conf]
      );

      // CRITICAL FIX: Make the simulation ultra-dynamic by natively appending it to the historical dataset as 'tomorrow'.
      // This will force every single card on the Insights and Dashboard pages to geometrically shift!
      try {
        const nextDateQ = await pool.query(`SELECT MAX(date) + interval '1 day' as next_date FROM temperature_data`);
        let nextDate = nextDateQ.rows[0].next_date || '2026-05-01';

        await pool.query(
          `INSERT INTO temperature_data (date, avg_temperature, heatwave_flag)
           VALUES ($1, $2, $3)`,
          [nextDate, temperature, heatwave_flag ? true : false]
        );

        await pool.query(
          `INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [finalCid, nextDate, basePrice, predictedPrice, Math.max(predictedPrice, basePrice) * 1.01, Math.min(predictedPrice, basePrice) * 0.99, parseInt(Math.random()*5000000 + 1000000)]
        );
      } catch (insertErr) {
        console.error("Simulation integration error:", insertErr); // Non-fatal, just logs
      }

      // Calculate return relative to basePrice
      const returnPct = ((predictedPrice - basePrice) / basePrice) * 100;
      
      // Calculate a pseudo-volatility score combining heatwave factor and temperature deviation
      let vol = 0.0150 + (Math.abs(30 - parseFloat(temperature)) * 0.0015);
      if (heatwave_flag) vol += 0.0250;

      res.json({
        prediction: predictedPrice,
        trend: trend,
        confidence: conf,
        returnPct: returnPct,
        volatility: vol
      });

    } catch (parseError) {
      console.error(parseError);
      res.status(500).json({ error: 'Failed to parse prediction output', raw: stdout });
    }
  });
});

app.get('/api/insights', async (req, res) => {
  try {
    // ─── 1. Temperature overview ──────────────────────────────────────────────
    const tempStats = await pool.query(`
      SELECT
        COUNT(*)::int                                                   AS total_records,
        AVG(avg_temperature)::numeric(5,2)                             AS avg_temp,
        MAX(avg_temperature)::numeric(5,2)                             AS max_temp,
        MIN(avg_temperature)::numeric(5,2)                             AS min_temp,
        STDDEV(avg_temperature)::numeric(5,2)                          AS stddev_temp,
        SUM(CASE WHEN heatwave_flag = true  THEN 1 ELSE 0 END)::int    AS heatwave_days,
        SUM(CASE WHEN heatwave_flag = false THEN 1 ELSE 0 END)::int    AS normal_days
      FROM (SELECT * FROM temperature_data ORDER BY date DESC LIMIT 15) sub
    `);

    // ─── 2. Stock price: heatwave days vs normal days (Sector wide) ────────────
    const heatwaveStockQ = await pool.query(`
      SELECT
        AVG(CASE WHEN t.heatwave_flag = true  THEN s.close_price END)::numeric(10,2) AS avg_price_heatwave,
        AVG(CASE WHEN t.heatwave_flag = false THEN s.close_price END)::numeric(10,2) AS avg_price_normal,
        MAX(s.close_price)::numeric(10,2)                                             AS max_price,
        MIN(s.close_price)::numeric(10,2)                                             AS min_price,
        AVG(s.close_price)::numeric(10,2)                                             AS avg_price_all,
        STDDEV(s.close_price)::numeric(10,2)                                          AS stddev_price
      FROM (SELECT * FROM stock_data ORDER BY date DESC LIMIT 15) s
      JOIN temperature_data t ON s.date = t.date
    `);

    // ─── 3. Prediction stats (from predictions log table) ────────────────────
    const predStats = await pool.query(`
      SELECT
        COUNT(*)::int                                                              AS total_preds,
        SUM(CASE WHEN predicted_trend = 'Bullish' THEN 1 ELSE 0 END)::int         AS bullish_count,
        SUM(CASE WHEN predicted_trend = 'Bearish' THEN 1 ELSE 0 END)::int         AS bearish_count,
        SUM(CASE WHEN predicted_trend = 'Neutral' THEN 1 ELSE 0 END)::int         AS neutral_count,
        AVG(confidence_score)::numeric(5,1)                                        AS avg_confidence,
        MAX(confidence_score)::numeric(5,1)                                        AS max_confidence,
        AVG(input_temperature)::numeric(5,2)                                       AS avg_pred_temp
      FROM predictions
    `);

    // ─── 4. High-temp correlation (Sector wide) ──────────────────────────────
    const corrQ = await pool.query(`
      SELECT
        AVG(CASE WHEN t.avg_temperature > (SELECT AVG(avg_temperature) FROM temperature_data)
                 THEN s.close_price END)::numeric(10,2)  AS avg_price_high_temp,
        AVG(CASE WHEN t.avg_temperature <= (SELECT AVG(avg_temperature) FROM temperature_data)
                 THEN s.close_price END)::numeric(10,2)  AS avg_price_low_temp
      FROM (SELECT * FROM stock_data ORDER BY date DESC LIMIT 15) s
      JOIN (SELECT * FROM temperature_data ORDER BY date DESC LIMIT 15) t ON s.date = t.date
    `);

    const tr = tempStats.rows[0];
    const sr = heatwaveStockQ.rows[0];
    const pr = predStats.rows[0];
    const cr = corrQ.rows[0];

    // Compute derived insight values
    const heatwavePriceImpact = sr.avg_price_heatwave && sr.avg_price_normal
      ? (((sr.avg_price_heatwave - sr.avg_price_normal) / sr.avg_price_normal) * 100).toFixed(2)
      : null;

    const highTempPriceImpact = cr.avg_price_high_temp && cr.avg_price_low_temp
      ? (((cr.avg_price_high_temp - cr.avg_price_low_temp) / cr.avg_price_low_temp) * 100).toFixed(2)
      : null;

    const priceVolatilityPct = sr.avg_price_all && sr.stddev_price
      ? (((parseFloat(sr.stddev_price) / parseFloat(sr.avg_price_all)) * 100)).toFixed(2)
      : null;

    const heatwaveRatio = tr.total_records > 0
      ? ((tr.heatwave_days / tr.total_records) * 100).toFixed(1)
      : 0;

    res.json({
      temperature: {
        avg:        parseFloat(tr.avg_temp),
        max:        parseFloat(tr.max_temp),
        min:        parseFloat(tr.min_temp),
        stddev:     parseFloat(tr.stddev_temp),
        totalDays:  tr.total_records,
        heatwaveDays: tr.heatwave_days,
        normalDays:   tr.normal_days,
        heatwaveRatioPct: parseFloat(heatwaveRatio)
      },
      stockPrice: {
        avgAll:          parseFloat(sr.avg_price_all),
        avgHeatwave:     parseFloat(sr.avg_price_heatwave),
        avgNormal:       parseFloat(sr.avg_price_normal),
        max:             parseFloat(sr.max_price),
        min:             parseFloat(sr.min_price),
        stddev:          parseFloat(sr.stddev_price),
        heatwaveImpactPct:  heatwavePriceImpact !== null ? parseFloat(heatwavePriceImpact) : null,
        highTempImpactPct:  highTempPriceImpact !== null ? parseFloat(highTempPriceImpact) : null,
        volatilityPct:      priceVolatilityPct  !== null ? parseFloat(priceVolatilityPct)  : null,
      },
      predictions: {
        total:         pr.total_preds,
        bullish:       pr.bullish_count,
        bearish:       pr.bearish_count,
        neutral:       pr.neutral_count,
        avgConfidence: parseFloat(pr.avg_confidence),
        maxConfidence: parseFloat(pr.max_confidence),
        avgInputTemp:  parseFloat(pr.avg_pred_temp)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// ── Climate Summary (full-table counts for Pie Chart) ────────────────────────
app.get('/api/climate-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int                                                  AS total_records,
        SUM(CASE WHEN heatwave_flag = true  THEN 1 ELSE 0 END)::int   AS heatwave_days,
        SUM(CASE WHEN heatwave_flag = false THEN 1 ELSE 0 END)::int   AS normal_days,
        AVG(avg_temperature)::numeric(5,1)                            AS avg_temp,
        MAX(avg_temperature)::numeric(5,1)                            AS max_temp
      FROM temperature_data
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch climate summary' });
  }
});

// ── AI Chatbot Route ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // ─── 1. Fetch live DB context to ground the AI ───────────────────────────
    let liveContext = {};
    try {
      const tempAgg = await pool.query(
        `SELECT AVG(avg_temperature)::numeric(5,1) AS avg_t,
                MAX(avg_temperature)::numeric(5,1) AS max_t,
                SUM(CASE WHEN heatwave_flag THEN 1 ELSE 0 END)::int AS heatwaves,
                COUNT(*)::int AS total_records
         FROM temperature_data`
      );
      const latestStock = await pool.query(
        `SELECT close_price FROM stock_data WHERE company_id = 1 ORDER BY date DESC LIMIT 1`
      );
      const recentPredictions = await pool.query(
        `SELECT predicted_trend, confidence_score::numeric(5,1), input_temperature
         FROM predictions ORDER BY id DESC LIMIT 3`
      );

      const tr = tempAgg.rows[0];
      liveContext = {
        avgTemp: tr.avg_t || 'N/A',
        maxTemp: tr.max_t || 'N/A',
        heatwaveDays: tr.heatwaves || 0,
        totalRecords: tr.total_records || 0,
        latestStockPrice: latestStock.rows[0]?.close_price || 'N/A',
        recentPredictions: recentPredictions.rows
      };
    } catch (dbErr) {
      console.warn('Could not fetch live DB context for chat:', dbErr.message);
    }

    const predSummary = liveContext.recentPredictions?.length > 0
      ? liveContext.recentPredictions
          .map(p => `${p.predicted_trend} (${p.confidence_score}% conf @ ${p.input_temperature}°C)`)
          .join(', ')
      : 'No recent predictions yet';

    // ─── 2. System Prompt — ClimateIQ Persona ───────────────────────────────
    const systemInstruction = `You are ClimateIQ, an expert AI assistant embedded inside the ClimateStock India platform — a real-time analytics application that correlates Indian regional climate data (temperature, heatwave events) with energy sector stock performance.

You specialize in:
- Climate-finance correlations (how temperature affects energy stocks)
- Indian energy sector companies: Reliance Industries, Tata Power, NTPC, Adani Green, Power Grid Corp
- XGBoost ML model predictions for stock price direction
- Heatwave impact analysis on electricity demand and stock volatility
- Investment considerations based on climate risk

LIVE APPLICATION DATA (real-time from PostgreSQL):
- Average Temperature (all records): ${liveContext.avgTemp}°C
- Peak Temperature Logged: ${liveContext.maxTemp}°C
- Heatwave Days Detected: ${liveContext.heatwaveDays} days
- Total Climate Records in DB: ${liveContext.totalRecords}
- Latest Reliance Energy Stock Price: ₹${liveContext.latestStockPrice}
- Recent ML Prediction Results: ${predSummary}

GUIDELINES:
- Be concise, analytical, and data-driven. Reference the live data above when relevant.
- Format numbers with ₹ for prices and °C for temperatures.
- Keep responses under 200 words unless a detailed explanation is explicitly requested.
- If asked about topics unrelated to finance or climate, politely redirect to your specialization.
- Speak confidently as an embedded app assistant, not as a general-purpose AI.
- CRITICAL: Always end your response by actively asking the user a related follow-up question to keep them engaged (e.g., "Would you like me to evaluate a specific stock tier?", "Should we analyze a different temperature scenario?").`;

    // ─── 3. Final Model Selection & Call (Via Python) ────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.length < 10) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing or invalid in backend/.env' });
    }

    const inputData = {
      message: message,
      systemInstruction: systemInstruction,
      apiKey: apiKey,
      history: history || []
    };

    const scriptPath = path.join(__dirname, 'chat.py');
    const { execFile } = require('child_process');

    const pyProcess = execFile('python', [scriptPath], (error, stdout, stderr) => {
        if (error) {
          console.error("Python Chat Script Execution Error:", error);
          return res.status(500).json({ error: 'AI chat service error. Please ensure Python is installed.', details: stderr });
        }

        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            res.json({ reply: result.reply });
          } else {
            console.error("Python Chat Script API Error:", result.error);
            res.status(500).json({ error: 'AI Error', details: result.error });
          }
        } catch (parseErr) {
          console.error("Failed to parse Python chat script output:", stdout);
          res.status(500).json({ error: 'Failed to parse AI output', details: stdout });
        }
    });

    pyProcess.stdin.write(JSON.stringify(inputData));
    pyProcess.stdin.end();

  } catch (err) {
    console.error('🔥 CRITICAL CHAT ERROR:', err);
    res.status(500).json({ 
      error: 'AI chat setup error', 
      details: err.message || 'Unknown error occurred'
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

