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
    console.log('Starting Database setup and CSV bulk import...');

    // 1. Create Tables first!
    const sqlPath = path.join(__dirname, 'init_db.sql');
    const sqlSchema = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Creating tables from schema...');
    await client.query(sqlSchema);
    console.log('Tables created successfully.');

    // 2. Wipe any seeded mock data that init_db.sql might have created
    await client.query('TRUNCATE predictions, stock_data, temperature_data, companies RESTART IDENTITY CASCADE');
    console.log('Cleared mock data, ready for CSV.');

    // 3. Read the CSV file
    console.log('Reading CSV file...');
    const csvPath = path.join(__dirname, '..', 'final_processed_data .csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',');
    
    // Find index offsets based on CSV headers
    const dateIdx = headers.indexOf('Date');
    const closeIdx = headers.indexOf('CLOSE');
    const stockIdx = headers.indexOf('Stock');
    const tempIdx = headers.indexOf('Temperature');
    const heatwaveIdx = headers.indexOf('Heatwave');
    
    let processed = 0;
    
    await client.query('BEGIN');
    
    // We can cache company IDs to avoid hammering the DB
    const companyCache = {};

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < Math.max(dateIdx, closeIdx, stockIdx, tempIdx, heatwaveIdx)) continue;
        
        const dateRaw = parts[dateIdx];
        const closeRaw = parseFloat(parts[closeIdx]) || 0;
        const stockRaw = parts[stockIdx].trim();
        const tempRaw = parseFloat(parts[tempIdx]) || 0;
        const hwRaw = parseInt(parts[heatwaveIdx]) === 1;

        // Ensure company is inserted and get ID with caching
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
        
        // Insert Temperature
        await client.query(
            `INSERT INTO temperature_data (date, region, avg_temperature, heatwave_flag) 
             VALUES ($1, 'Unknown', $2, $3) ON CONFLICT DO NOTHING`,
             [dateRaw, tempRaw, hwRaw]
        );

        // Insert Stock Data
        await client.query(
            `INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume) 
             VALUES ($1, $2, $3, $3, $3, $3, 0) ON CONFLICT DO NOTHING`,
             [compId, dateRaw, closeRaw]
        );

        processed++;
        if (processed % 1000 === 0) {
            console.log(`Inserted ${processed} rows...`);
        }
    }
    
    await client.query('COMMIT');
    console.log(`Successfully migrated ${processed} records from final_processed_data .csv into Database!`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing CSV:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedData();
