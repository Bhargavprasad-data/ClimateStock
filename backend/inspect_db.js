const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'climate_stock',
  password: 'NewPassword123',
  port: 5432,
});

async function check() {
  const latestRes = await pool.query('SELECT MAX(date) as max_date, MIN(date) as min_date FROM stock_data WHERE company_id = 1');
  console.log("Date range for company 1:", latestRes.rows[0]);

  const query = `
      SELECT date, close_price
      FROM stock_data
      WHERE company_id = 1 
      ORDER BY date DESC
      LIMIT 5
    `;
  const result = await pool.query(query);
  console.log("Latest 5 records:", result.rows);
  process.exit(0);
}
check();
