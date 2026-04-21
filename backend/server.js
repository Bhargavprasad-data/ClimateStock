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
    // 1. Check if tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'climate_stock_data'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('🔄 Tables missing. Initializing schema from init_db.sql...');
      const sqlPath = path.join(__dirname, 'init_db.sql');
      const sqlSchema = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sqlSchema);
      console.log('✅ Schema created successfully.');
    }

    // 2. Check if data exists in the full feature table
    const dataCheck = await pool.query('SELECT COUNT(*) FROM climate_stock_data');
    if (parseInt(dataCheck.rows[0].count) === 0) {
      console.log('📂 Database empty. Seeding from final_processed_data.csv...');
      await seedFromCSV();
    } else {
      console.log(`✔ Database already contains ${dataCheck.rows[0].count} records. Skipping seed.`);
    }
  } catch (err) {
    console.error('❌ Database Initialization Error:', err.message);
  }
}

async function seedFromCSV() {
  try {
    const csvPath = path.join(__dirname, '..', 'final_processed_data.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return;
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',');
    const col = {};
    headers.forEach((h, i) => { col[h.trim()] = i; });

    console.log(`⌛ Inserting ${lines.length - 1} records with all ${headers.length} features...`);

    await pool.query('BEGIN');
    const companyCache = {};
    let processed = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < headers.length) continue;

      const dateRaw = parts[col['Date']]?.trim();
      const closeRaw = parseFloat(parts[col['CLOSE']]) || 0;
      const stockRaw = parts[col['Stock']]?.trim();
      const tempRaw = parseFloat(parts[col['Temperature']]) || 0;
      const hwRaw = parseInt(parts[col['Heatwave']]) === 1;
      const returnPct = parseFloat(parts[col['Return']]) || 0;
      const cdd = parseFloat(parts[col['CDD']]) || 0;
      const cdd7 = parseFloat(parts[col['CDD_7']]) || 0;
      const tempAnomaly = parseFloat(parts[col['Temp_Anomaly']]) || 0;
      const cddLag1 = parseFloat(parts[col['CDD_Lag1']]) || 0;
      const cddLag3 = parseFloat(parts[col['CDD_Lag3']]) || 0;
      const returnLag1 = parseFloat(parts[col['Return_Lag1']]) || 0;
      const returnLag3 = parseFloat(parts[col['Return_Lag3']]) || 0;
      const returnLag5 = parseFloat(parts[col['Return_Lag5']]) || 0;
      const ma5 = parseFloat(parts[col['MA_5']]) || 0;
      const volatility = parseFloat(parts[col['Volatility']]) || 0;
      const demandTrend = parseFloat(parts[col['Demand_Trend']]) || 0;
      const trend = parseFloat(parts[col['Trend']]) || 0;
      const volChange = parseFloat(parts[col['Volatility_Change']]) || 0;
      const direction = parseInt(parts[col['Direction']]) || 0;

      if (!stockRaw || !dateRaw) continue;

      // Upsert company
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

      // Legacy: temperature_data
      await pool.query(
        `INSERT INTO temperature_data (date, region, avg_temperature, heatwave_flag) 
         VALUES ($1, 'India', $2, $3) ON CONFLICT DO NOTHING`,
        [dateRaw, tempRaw, hwRaw]
      );

      // Legacy: stock_data
      await pool.query(
        `INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [compId, dateRaw, closeRaw, closeRaw, closeRaw * 1.01, closeRaw * 0.99,
          Math.floor(Math.random() * 5000000 + 1000000)]
      );

      // Full feature table: climate_stock_data
      await pool.query(
        `INSERT INTO climate_stock_data 
         (company_id, date, close_price, return_pct, stock, temperature, cdd, cdd_7, temp_anomaly, 
          heatwave, cdd_lag1, cdd_lag3, return_lag1, return_lag3, return_lag5, ma_5, volatility, 
          demand_trend, trend, volatility_change, direction)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (company_id, date) DO NOTHING`,
        [compId, dateRaw, closeRaw, returnPct, stockRaw, tempRaw, cdd, cdd7, tempAnomaly,
          hwRaw ? 1 : 0, cddLag1, cddLag3, returnLag1, returnLag3, returnLag5, ma5, volatility,
          demandTrend, trend, volChange, direction]
      );

      processed++;
      if (processed % 2000 === 0) console.log(`   ...inserted ${processed} rows`);
    }

    await pool.query('COMMIT');
    console.log(`✅ Successfully seeded ${processed} records (all features)!`);
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
    const { company_id } = req.query;
    const cid = company_id ? parseInt(company_id) : 1;

    // 1. Get the actual length of data for this specific company so the offset wraps safely
    const countRes = await pool.query('SELECT COUNT(*) FROM stock_data WHERE company_id = $1', [cid]);
    const totalRows = parseInt(countRes.rows[0].count) || 100;

    // 2. Implement time-based offset streaming wrapping cleanly within the company's data length
    const elapsedSeconds = Math.floor((Date.now() - START_TIME) / 8000);
    let offset = elapsedSeconds % (totalRows > 30 ? totalRows - 30 : 1);

    // 3. Drive the timeline from the company's dataset, pulling in the temperature for those days
    const query = `
      SELECT s.date, t.avg_temperature, t.heatwave_flag, s.close_price
      FROM stock_data s
      LEFT JOIN temperature_data t ON s.date = t.date
      WHERE s.company_id = $1
      ORDER BY s.date ASC
      LIMIT 30 OFFSET $2
    `;
    const result = await pool.query(query, [cid, offset]);

    const combined = result.rows.map(row => {
      return {
        date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: new Date(row.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        temperature: parseFloat(row.avg_temperature),
        heatwave_flag: row.heatwave_flag,
        stockPrice: row.close_price ? parseFloat(row.close_price) : null,
      };
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
  let symbol = 'ADANIPOWER.NS'; // default

  if (company_id) {
    try {
      const compQ = await pool.query(`SELECT symbol FROM companies WHERE id = $1`, [company_id]);
      if (compQ.rows.length > 0) symbol = compQ.rows[0].symbol;

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
    } catch (e) {
      console.error("Failed to map fallback prices:", e);
    }
  }

  const payload = JSON.stringify({
    temperature: parseFloat(temperature),
    heatwave_flag: heatwave_flag ? 1 : 0,
    ma_5: ma_5,
    lag1: lag1,
    lag3: lag3,
    lag5: lag5,
    symbol: symbol
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

      // ── Trend: prefer RF classifier output, fallback to price heuristic ──
      let trend = 'Neutral';
      if (output.rf_trend) {
        trend = output.rf_trend;
      } else {
        if (predictedPrice > basePrice * 1.01) trend = 'Bullish';
        else if (predictedPrice < basePrice * 0.99) trend = 'Bearish';
      }

      // ── Confidence: prefer RF classifier probability, fallback to heuristic ──
      let conf;
      if (output.rf_confidence !== undefined && output.rf_confidence !== null) {
        conf = output.rf_confidence;
      } else {
        conf = 92.5 - Math.abs(30 - parseFloat(temperature)) * 1.5;
        if (heatwave_flag) conf -= 25.0;
        if (Math.abs(predictedPrice - basePrice) > basePrice * 0.20) conf -= 30.0;
      }
      conf = Math.max(10.0, Math.min(99.9, conf));

      // RF probability breakdown (if available)
      const rfProbabilities = output.rf_probabilities || null;

      // Ensure we ALWAYS insert the prediction to log it for Insights
      const finalCid = company_id ? parseInt(company_id) : 1;

      await pool.query(
        `INSERT INTO predictions (company_id, date, input_temperature, predicted_price, predicted_trend, confidence_score)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
        [finalCid, temperature, predictedPrice, trend, conf]
      );

      // Append simulation to historical dataset for dynamic dashboard updates
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
          [finalCid, nextDate, basePrice, predictedPrice, Math.max(predictedPrice, basePrice) * 1.01, Math.min(predictedPrice, basePrice) * 0.99, parseInt(Math.random() * 5000000 + 1000000)]
        );
      } catch (insertErr) {
        console.error("Simulation integration error:", insertErr); // Non-fatal, just logs
      }

      // Calculate return relative to basePrice
      const returnPct = ((predictedPrice - basePrice) / basePrice) * 100;

      // Calculate volatility score
      let vol = 0.0150 + (Math.abs(30 - parseFloat(temperature)) * 0.0015);
      if (heatwave_flag) vol += 0.0250;

      res.json({
        prediction: predictedPrice,
        trend: trend,
        confidence: conf,
        returnPct: returnPct,
        volatility: vol,
        rfProbabilities: rfProbabilities,
        fundamentals: output.fundamentals
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
        avg: parseFloat(tr.avg_temp),
        max: parseFloat(tr.max_temp),
        min: parseFloat(tr.min_temp),
        stddev: parseFloat(tr.stddev_temp),
        totalDays: tr.total_records,
        heatwaveDays: tr.heatwave_days,
        normalDays: tr.normal_days,
        heatwaveRatioPct: parseFloat(heatwaveRatio)
      },
      stockPrice: {
        avgAll: parseFloat(sr.avg_price_all),
        avgHeatwave: parseFloat(sr.avg_price_heatwave),
        avgNormal: parseFloat(sr.avg_price_normal),
        max: parseFloat(sr.max_price),
        min: parseFloat(sr.min_price),
        stddev: parseFloat(sr.stddev_price),
        heatwaveImpactPct: heatwavePriceImpact !== null ? parseFloat(heatwavePriceImpact) : null,
        highTempImpactPct: highTempPriceImpact !== null ? parseFloat(highTempPriceImpact) : null,
        volatilityPct: priceVolatilityPct !== null ? parseFloat(priceVolatilityPct) : null,
      },
      predictions: {
        total: pr.total_preds,
        bullish: pr.bullish_count,
        bearish: pr.bearish_count,
        neutral: pr.neutral_count,
        avgConfidence: parseFloat(pr.avg_confidence),
        maxConfidence: parseFloat(pr.max_confidence),
        avgInputTemp: parseFloat(pr.avg_pred_temp)
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

// ── Current & Historical Weather Route ──────────────────────────────────────────
app.get('/api/weather', async (req, res) => {
  const apiKey = process.env.WEATHER_API_KEY;
  const city = req.query.city || process.env.WEATHER_CITY || 'Mumbai';
  const queryDate = req.query.date; // e.g., 'YYYY-MM-DD'

  const todayStr = new Date().toISOString().split('T')[0];

  // If a specific past/future date is requested (not today)
  if (queryDate && queryDate !== todayStr) {
    try {
      // Look up historical data from the database
      const dbRes = await pool.query(
        'SELECT avg_temperature, heatwave_flag FROM temperature_data WHERE date::date = $1',
        [queryDate]
      );

      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        const reqDate = new Date(queryDate);
        return res.json({
          source: 'database',
          city: city !== 'Mumbai' ? city : 'Indian Region',
          country: 'IN',
          temperature: parseFloat(row.avg_temperature),
          heatwave: row.heatwave_flag,
          feelsLike: parseFloat(row.avg_temperature) + 2.5,
          humidity: '--',
          description: row.heatwave_flag ? 'Historical Heatwave' : 'Historical Data',
          windSpeed: '--',
          date: queryDate,
          dateLabel: reqDate.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric'
          })
        });
      } else {
        // If no data exists for the selected date, provide a simulated realistic climate value
        const reqDate = new Date(queryDate);
        const month = reqDate.getMonth(); // 0-11
        // Summer months (April-June) are hotter
        let baseTemp = 32 + (Math.sin(((month - 3) / 12) * Math.PI) * 8);
        let isHeatwave = baseTemp > 38 && Math.random() > 0.5;

        return res.json({
          source: 'simulated',
          city: city !== 'Mumbai' ? city : 'Indian Region',
          country: 'IN',
          temperature: parseFloat(baseTemp.toFixed(1)),
          heatwave: isHeatwave,
          feelsLike: parseFloat((baseTemp + 2).toFixed(1)),
          humidity: '45',
          description: 'Simulated Climate Data',
          windSpeed: '--',
          date: queryDate,
          dateLabel: reqDate.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric'
          })
        });
      }
    } catch (e) {
      console.error('DB Weather fetch error:', e);
      return res.status(500).json({ error: 'Failed to fetch historical weather data' });
    }
  }

  // Otherwise, use OpenWeatherMap for live today's weather
  if (!apiKey || apiKey === 'your_openweathermap_api_key_here') {
    return res.status(503).json({ error: 'WEATHER_API_KEY not configured in backend/.env' });
  }

  const https = require('https');
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

  https.get(url, (owmRes) => {
    let raw = '';
    owmRes.on('data', chunk => { raw += chunk; });
    owmRes.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (data.cod !== 200) {
          return res.status(502).json({ error: data.message || 'Weather API error' });
        }
        const now = new Date();
        res.json({
          source: 'live',
          city: data.name,
          country: data.sys.country,
          temperature: parseFloat(data.main.temp.toFixed(1)),
          feelsLike: parseFloat(data.main.feels_like.toFixed(1)),
          humidity: data.main.humidity,
          description: data.weather[0].description,
          windSpeed: data.wind.speed,
          date: now.toISOString(),                         // ISO for frontend formatting
          dateLabel: now.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric'
          })
        });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse weather response', raw });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: 'Weather API request failed', details: e.message });
  });
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
- Dual-Model ML Engine: XGBoost for precise stock price predictions & Random Forest for trend classification/probability
- Safe Range mapping and spotting Volatility/Price Spikes (based on native ML output features)
- Heatwave impact analysis on electricity demand and supply chains
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

