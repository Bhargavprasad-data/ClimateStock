require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

async function seedData() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Database setup and full CSV import...');
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   Host: ${process.env.DB_HOST}`);

    // 1. Run schema SQL
    const sqlPath = path.join(__dirname, 'init_db.sql');
    const sqlSchema = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Creating/recreating tables from schema...');
    await client.query(sqlSchema);
    console.log('✅ Tables created successfully.');

    // 2. Read the CSV file
    const csvPath = path.join(__dirname, '..', 'final_processed_data.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return;
    }
    
    console.log('📂 Reading CSV file...');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    
    if (lines.length < 2) {
      console.error('❌ CSV file is empty or has no data rows.');
      return;
    }

    const headers = lines[0].split(',');
    console.log(`   Found ${lines.length - 1} data rows, ${headers.length} columns`);
    console.log(`   Columns: ${headers.join(', ')}`);

    // Map column indices
    const col = {};
    headers.forEach((h, i) => { col[h.trim()] = i; });

    // Validate required columns
    const required = ['Date', 'CLOSE', 'Stock', 'Temperature', 'Heatwave'];
    for (const r of required) {
      if (col[r] === undefined) {
        console.error(`❌ Required column "${r}" not found in CSV. Available: ${headers.join(', ')}`);
        return;
      }
    }

    await client.query('BEGIN');

    // 3. Insert all rows
    const companyCache = {};
    let processed = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < headers.length) continue;

      try {
        const dateRaw       = parts[col['Date']]?.trim();
        const closeRaw      = parseFloat(parts[col['CLOSE']]) || 0;
        const stockRaw      = parts[col['Stock']]?.trim();
        const tempRaw       = parseFloat(parts[col['Temperature']]) || 0;
        const hwRaw         = parseInt(parts[col['Heatwave']]) === 1;
        const returnPct     = parseFloat(parts[col['Return']]) || 0;
        const cdd           = parseFloat(parts[col['CDD']]) || 0;
        const cdd7          = parseFloat(parts[col['CDD_7']]) || 0;
        const tempAnomaly   = parseFloat(parts[col['Temp_Anomaly']]) || 0;
        const cddLag1       = parseFloat(parts[col['CDD_Lag1']]) || 0;
        const cddLag3       = parseFloat(parts[col['CDD_Lag3']]) || 0;
        const returnLag1    = parseFloat(parts[col['Return_Lag1']]) || 0;
        const returnLag3    = parseFloat(parts[col['Return_Lag3']]) || 0;
        const returnLag5    = parseFloat(parts[col['Return_Lag5']]) || 0;
        const ma5           = parseFloat(parts[col['MA_5']]) || 0;
        const volatility    = parseFloat(parts[col['Volatility']]) || 0;
        const demandTrend   = parseFloat(parts[col['Demand_Trend']]) || 0;
        const trend         = parseFloat(parts[col['Trend']]) || 0;
        const volChange     = parseFloat(parts[col['Volatility_Change']]) || 0;
        const direction     = parseInt(parts[col['Direction']]) || 0;

        if (!stockRaw || !dateRaw) continue;

        // Upsert company
        let compId = companyCache[stockRaw];
        if (!compId) {
          const compRes = await client.query(
            `INSERT INTO companies (name, symbol, sector) VALUES ($1, $2, 'Energy') 
             ON CONFLICT (symbol) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [stockRaw, stockRaw]
          );
          compId = compRes.rows[0].id;
          companyCache[stockRaw] = compId;
        }

        // Insert into temperature_data (legacy table)
        await client.query(
          `INSERT INTO temperature_data (date, region, avg_temperature, heatwave_flag) 
           VALUES ($1, 'India', $2, $3) ON CONFLICT DO NOTHING`,
          [dateRaw, tempRaw, hwRaw]
        );

        // Insert into stock_data (legacy table)
        await client.query(
          `INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
          [compId, dateRaw, closeRaw, closeRaw, closeRaw * 1.01, closeRaw * 0.99, Math.floor(Math.random() * 5000000 + 1000000)]
        );

        // Insert into climate_stock_data (full feature table)
        await client.query(
          `INSERT INTO climate_stock_data 
           (company_id, date, close_price, return_pct, stock, temperature, cdd, cdd_7, temp_anomaly, 
            heatwave, cdd_lag1, cdd_lag3, return_lag1, return_lag3, return_lag5, ma_5, volatility, 
            demand_trend, trend, volatility_change, direction)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (company_id, date) DO UPDATE SET
             close_price = EXCLUDED.close_price,
             return_pct = EXCLUDED.return_pct,
             temperature = EXCLUDED.temperature,
             cdd = EXCLUDED.cdd,
             cdd_7 = EXCLUDED.cdd_7,
             temp_anomaly = EXCLUDED.temp_anomaly,
             heatwave = EXCLUDED.heatwave,
             cdd_lag1 = EXCLUDED.cdd_lag1,
             cdd_lag3 = EXCLUDED.cdd_lag3,
             return_lag1 = EXCLUDED.return_lag1,
             return_lag3 = EXCLUDED.return_lag3,
             return_lag5 = EXCLUDED.return_lag5,
             ma_5 = EXCLUDED.ma_5,
             volatility = EXCLUDED.volatility,
             demand_trend = EXCLUDED.demand_trend,
             trend = EXCLUDED.trend,
             volatility_change = EXCLUDED.volatility_change,
             direction = EXCLUDED.direction`,
          [compId, dateRaw, closeRaw, returnPct, stockRaw, tempRaw, cdd, cdd7, tempAnomaly,
           hwRaw ? 1 : 0, cddLag1, cddLag3, returnLag1, returnLag3, returnLag5, ma5, volatility,
           demandTrend, trend, volChange, direction]
        );

        processed++;
        if (processed % 1000 === 0) {
          console.log(`   ⌛ Inserted ${processed} / ${lines.length - 1} rows...`);
        }

      } catch (rowErr) {
        errors++;
        if (errors <= 5) {
          console.warn(`   ⚠️ Row ${i} error: ${rowErr.message}`);
        }
      }
    }

    await client.query('COMMIT');
    
    // 4. Summary
    const countCompanies = await client.query('SELECT COUNT(*) FROM companies');
    const countTemp      = await client.query('SELECT COUNT(*) FROM temperature_data');
    const countStock     = await client.query('SELECT COUNT(*) FROM stock_data');
    const countFull      = await client.query('SELECT COUNT(*) FROM climate_stock_data');
    
    console.log('\n✅ Database seeding complete!');
    console.log('────────────────────────────────────────');
    console.log(`   Companies:           ${countCompanies.rows[0].count}`);
    console.log(`   Temperature records: ${countTemp.rows[0].count}`);
    console.log(`   Stock data records:  ${countStock.rows[0].count}`);
    console.log(`   Full feature data:   ${countFull.rows[0].count}`);
    console.log(`   Processed rows:      ${processed}`);
    if (errors > 0) console.log(`   Errors:              ${errors}`);
    console.log('────────────────────────────────────────');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error importing CSV:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedData();
