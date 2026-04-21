-- ============================================================================
-- ClimateStock India – Full Database Schema
-- Database: Stockmarket (from .env DB_NAME)
-- ============================================================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS stock_data CASCADE;
DROP TABLE IF EXISTS temperature_data CASCADE;
DROP TABLE IF EXISTS climate_stock_data CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- ── Companies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    sector VARCHAR(100) DEFAULT 'Energy'
);

-- ── Legacy Temperature Data (kept for dashboard/insights compatibility) ─────
CREATE TABLE IF NOT EXISTS temperature_data (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    region VARCHAR(100) DEFAULT 'India',
    avg_temperature NUMERIC(8,4),
    heatwave_flag BOOLEAN DEFAULT FALSE
);

-- ── Legacy Stock Data (kept for dashboard/insights compatibility) ────────────
CREATE TABLE IF NOT EXISTS stock_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    date DATE NOT NULL,
    open_price NUMERIC(15,6),
    close_price NUMERIC(15,6),
    high_price NUMERIC(15,6),
    low_price NUMERIC(15,6),
    volume BIGINT DEFAULT 0
);

-- ── Full Climate-Stock Feature Data (all 20 CSV columns) ────────────────────
-- This table stores the complete processed dataset for ML model usage.
CREATE TABLE IF NOT EXISTS climate_stock_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    date DATE NOT NULL,
    close_price NUMERIC(15,6),
    return_pct NUMERIC(20,16),
    stock VARCHAR(50),
    temperature NUMERIC(8,4),
    cdd NUMERIC(20,16),
    cdd_7 NUMERIC(20,16),
    temp_anomaly NUMERIC(20,16),
    heatwave INTEGER DEFAULT 0,
    cdd_lag1 NUMERIC(20,16),
    cdd_lag3 NUMERIC(20,16),
    return_lag1 NUMERIC(20,16),
    return_lag3 NUMERIC(20,16),
    return_lag5 NUMERIC(20,16),
    ma_5 NUMERIC(20,16),
    volatility NUMERIC(20,16),
    demand_trend NUMERIC(20,16),
    trend NUMERIC(20,16),
    volatility_change NUMERIC(20,16),
    direction INTEGER DEFAULT 0,
    UNIQUE(company_id, date)
);

-- ── Predictions Log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    date DATE NOT NULL,
    input_temperature NUMERIC(8,4),
    predicted_price NUMERIC(15,6),
    predicted_trend VARCHAR(50),
    confidence_score NUMERIC(5,2)
);

-- ── Indexes for performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_climate_stock_date ON climate_stock_data(date);
CREATE INDEX IF NOT EXISTS idx_climate_stock_company ON climate_stock_data(company_id);
CREATE INDEX IF NOT EXISTS idx_temp_data_date ON temperature_data(date);
CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data(date);
CREATE INDEX IF NOT EXISTS idx_stock_data_company ON stock_data(company_id);
