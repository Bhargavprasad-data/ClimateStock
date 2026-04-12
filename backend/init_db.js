require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'climatestock_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function initDB() {
  try {
    const sqlPath = path.join(__dirname, 'init_db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running schema initialization...');
    await pool.query(sql);
    console.log('Database initialized successfully with mock data!');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    pool.end();
  }
}

initDB();
