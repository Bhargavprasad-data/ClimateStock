DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS stock_data CASCADE;
DROP TABLE IF EXISTS temperature_data CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    sector VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS temperature_data (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    region VARCHAR(100),
    avg_temperature NUMERIC(5,2),
    heatwave_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS stock_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    date DATE NOT NULL,
    open_price NUMERIC(10,2),
    close_price NUMERIC(10,2),
    high_price NUMERIC(10,2),
    low_price NUMERIC(10,2),
    volume BIGINT
);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    date DATE NOT NULL,
    input_temperature NUMERIC(5,2),
    predicted_price NUMERIC(10,2),
    predicted_trend VARCHAR(50),
    confidence_score NUMERIC(5,2)
);

-- Seed some initial data
INSERT INTO companies (name, symbol, sector)
VALUES 
    ('Reliance Industries', 'RELIANCE', 'Energy'),
    ('Tata Power', 'TATAPOWER', 'Energy'),
    ('Adani Green Energy', 'ADANIGREEN', 'Energy')
ON CONFLICT (symbol) DO NOTHING;

-- Insert 30 days of dynamic temperature data
INSERT INTO temperature_data (date, region, avg_temperature, heatwave_flag)
SELECT 
    CURRENT_DATE - i,
    'Mumbai',
    ROUND(CAST(28 + random() * 10 AS NUMERIC), 1), -- random between 28 and 38
    random() > 0.8 -- 20% chance of heatwave
FROM generate_series(1, 30) AS i
ON CONFLICT DO NOTHING;

-- Insert 30 days of dynamic stock data for Reliance (company_id=1)
INSERT INTO stock_data (company_id, date, open_price, close_price, high_price, low_price, volume)
SELECT 
    1,
    CURRENT_DATE - i,
    ROUND(CAST(2400 + random() * 200 AS NUMERIC), 2),
    ROUND(CAST(2400 + random() * 200 AS NUMERIC), 2),
    ROUND(CAST(2600 + random() * 50 AS NUMERIC), 2),
    ROUND(CAST(2350 + random() * 50 AS NUMERIC), 2),
    CAST(1000000 + random() * 5000000 AS BIGINT)
FROM generate_series(1, 30) AS i
ON CONFLICT DO NOTHING;
