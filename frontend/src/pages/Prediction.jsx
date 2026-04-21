import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ArrowRight, AlertTriangle, TrendingUp, Thermometer, Activity, RefreshCw, MapPin, Wind, Droplets } from 'lucide-react';

const Prediction = () => {
  const [temperature, setTemperature] = useState('');
  const [heatwaveFlag, setHeatwaveFlag] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Weather state
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);
  const [tempManuallyEdited, setTempManuallyEdited] = useState(false);

  // Date & City state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inputCity, setInputCity] = useState('');

  // Fetch current weather from backend
  const fetchWeather = useCallback(async (forceRefill, dateStr, cityStr) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const url = new URL('http://localhost:5000/api/weather');
      if (dateStr) url.searchParams.append('date', dateStr);
      if (cityStr) url.searchParams.append('city', cityStr);

      const res = await axios.get(url.toString());
      setWeather(res.data);

      if (!tempManuallyEdited || forceRefill) {
        setTemperature(String(res.data.temperature));
        // Auto-set heatwave flag if it's from DB/Simulated
        if (res.data.heatwave !== undefined) {
          setHeatwaveFlag(res.data.heatwave);
        }
        if (forceRefill) setTempManuallyEdited(false);
      }
    } catch (err) {
      setWeatherError(err.response?.data?.error || 'Could not fetch weather data');
    } finally {
      setWeatherLoading(false);
    }
  }, [tempManuallyEdited]);

  useEffect(() => {
    fetchWeather(false, selectedDate, inputCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchWeather(true, newDate, inputCity);
  };

  const handleCityChange = (e) => {
    setInputCity(e.target.value);
  };

  const handleCityBlur = () => {
    fetchWeather(true, selectedDate, inputCity);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/stocks');
        setCompanies(res.data);
        if (!companyId && res.data.length > 0) {
          setCompanyId(res.data[0].id);
        }
        setInitialLoading(false);
      } catch (err) {
        console.warn('Prediction: backend not ready, retrying...');
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 8000);
    return () => clearInterval(intervalId);
  }, [companyId]);

  const runPrediction = async (temp, flag, cid) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.floor(Math.random() * 15) + 5;
        return next >= 90 ? 90 : next;
      });
    }, 150);

    try {
      const response = await axios.post('http://localhost:5000/api/predict', {
        temperature: parseFloat(temp),
        heatwave_flag: flag,
        company_id: parseInt(cid)
      });
      setTimeout(() => {
        clearInterval(timer);
        setProgress(100);
        setTimeout(() => {
          setResult(response.data);
          setLoading(false);
        }, 300);
      }, 1000);
    } catch (err) {
      clearInterval(timer);
      setError(err.response?.data?.error || 'Failed to connect to prediction service.');
      setLoading(false);
    }
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    runPrediction(temperature, heatwaveFlag, companyId);
  };

  const getConfidenceColor = (conf) => {
    if (conf < 50) return '#EF4444';
    if (conf < 75) return '#F59E0B';
    return '#10B981';
  };

  if (initialLoading) {
    return (
      <div className="prediction">
        <style>{`
          @keyframes shimmer {
            0%   { background-position: -600px 0; }
            100% { background-position:  600px 0; }
          }
          .sk {
            background: linear-gradient(90deg,
              rgba(130, 130, 130, 0.1) 25%,
              rgba(130, 130, 130, 0.25) 50%,
              rgba(130, 130, 130, 0.1) 75%
            );
            background-size: 600px 100%;
            animation: shimmer 1.6s infinite linear;
            border-radius: 8px;
          }
          @keyframes status-pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
        `}</style>
        <div className="page-header">
          <h1 className="page-title">Run ML Prediction</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{
              display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
              background: '#F59E0B', animation: 'status-pulse 1.4s ease-in-out infinite'
            }} />
            <p className="page-subtitle" style={{ margin: 0 }}>
              Connecting to database — waiting for backend…
            </p>
          </div>
        </div>
        <div className="grid-2">
          <div className="glass-panel border-top-blue">
            <div className="sk" style={{ width: '50%', height: '18px', marginBottom: '32px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div className="sk" style={{ width: '40%', height: '11px', marginBottom: '12px' }} />
                <div className="sk" style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
              </div>
              <div>
                <div className="sk" style={{ width: '45%', height: '11px', marginBottom: '12px' }} />
                <div className="sk" style={{ width: '100%', height: '50px', borderRadius: '12px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="sk" style={{ width: '50%', height: '11px', marginBottom: '12px' }} />
                  <div className="sk" style={{ width: '70%', height: '10px' }} />
                </div>
                <div className="sk" style={{ width: '50px', height: '28px', borderRadius: '34px' }} />
              </div>
              <div className="sk" style={{ width: '100%', height: '54px', borderRadius: '12px', marginTop: '12px' }} />
            </div>
          </div>
          <div className="glass-panel border-top-green" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="sk" style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '24px' }} />
            <div className="sk" style={{ width: '60%', height: '14px', marginBottom: '12px' }} />
            <div className="sk" style={{ width: '45%', height: '11px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prediction">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #10B981; }
          50%       { opacity: 0.5; box-shadow: 0 0 2px #10B981; }
        }
        @keyframes weather-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .weather-block { animation: weather-in 0.4s ease both; }
        .live-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #10B981;
        }
        .live-dot.live {
          animation: pulse-live 1.8s ease-in-out infinite;
        }
        .live-dot.historical {
          background: #F59E0B;
          box-shadow: 0 0 4px #F59E0B;
        }
        .live-dot.simulated {
          background: #3B82F6;
          box-shadow: 0 0 4px #3B82F6;
        }
        .live-chip {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #10B981;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.3);
          padding: 2px 8px;
          border-radius: 20px;
        }
        .live-chip.historical {
          color: #F59E0B;
          background: rgba(245,158,11,0.12);
          border-color: rgba(245,158,11,0.3);
        }
        .live-chip.simulated {
          color: #3B82F6;
          background: rgba(59,130,246,0.12);
          border-color: rgba(59,130,246,0.3);
        }
      `}</style>

      <div className="page-header">
        <h1 className="page-title">Run ML Prediction</h1>
        <p className="page-subtitle">Input current regional climate factors to predict the effect on Energy sector stocks using our state-of-the-art XGBoost model.</p>
      </div>

      <div className="grid-2">
        {/* ── Left Panel: Inputs ── */}
        <div className="glass-panel border-top-blue">
          <h2 style={{ marginBottom: '24px' }}>Input Parameters</h2>

          <form onSubmit={handlePredict}>
            {/* Company select */}
            <div className="input-group">
              <label className="input-label">Target Energy Company</label>
              <select
                className="input-field"
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setUserInteracted(true); }}
                required
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div className="input-group">
              <label className="input-label">Select Date for Climate Data</label>
              <input
                type="date"
                className="input-field"
                value={selectedDate}
                onChange={handleDateChange}
                required
              />
            </div>

            {/* City Input */}
            <div className="input-group">
              <label className="input-label">City (for live weather)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Mumbai, Visakhapatnam"
                value={inputCity}
                onChange={handleCityChange}
                onBlur={handleCityBlur}
              />
            </div>

            {/* Temperature with live/historical weather */}
            <div className="input-group">
              <label className="input-label">Average Temperature (°C)</label>

              {/* ── Weather info block ── */}
              <div className="weather-block" style={{ marginBottom: '10px' }}>

                {/* Loading state */}
                {weatherLoading && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '50px',
                    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                    fontSize: '12px', color: 'var(--color-text-secondary)', width: 'fit-content'
                  }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      border: '2px solid var(--color-accent)', borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Fetching climate data…
                  </div>
                )}

                {/* Error state */}
                {!weatherLoading && weatherError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '50px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    fontSize: '12px', color: '#EF4444', width: 'fit-content'
                  }}>
                    <AlertTriangle size={12} /> {weatherError}
                  </div>
                )}

                {/* Success: live badges row */}
                {!weatherLoading && weather && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Source + temp + description */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '50px',
                      background: 'linear-gradient(135deg, rgba(0,240,255,0.12), rgba(0,102,255,0.12))',
                      border: '1px solid rgba(0,240,255,0.3)',
                      fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)'
                    }}>
                      <span className={`live-dot ${weather.source}`} />
                      {weather.source === 'live' ? 'LIVE' : weather.source === 'database' ? 'HISTORICAL' : 'SIMULATED'} &bull; {weather.temperature}°C &mdash; {weather.description}
                    </div>

                    {/* Location */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '6px 12px', borderRadius: '50px',
                      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                      fontSize: '11px', color: 'var(--color-text-secondary)'
                    }}>
                      <MapPin size={11} /> {weather.city}, {weather.country}
                    </div>

                    {/* Date */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '6px 12px', borderRadius: '50px',
                      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                      fontSize: '11px', color: 'var(--color-text-secondary)'
                    }}>
                      📅 {weather.dateLabel}
                    </div>
                  </div>
                )}
              </div>

              {/* Temperature input */}
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  placeholder="e.g. 35.5"
                  value={temperature}
                  style={{ paddingRight: weather && !tempManuallyEdited ? '72px' : undefined }}
                  onChange={(e) => {
                    setTemperature(e.target.value);
                    setUserInteracted(true);
                    setTempManuallyEdited(true);
                  }}
                  required
                />
                {weather && !tempManuallyEdited && (
                  <span className={`live-chip ${weather.source}`} style={{
                    position: 'absolute', right: '14px', top: '50%',
                    transform: 'translateY(-50%)', pointerEvents: 'none'
                  }}>
                    {weather.source === 'live' ? 'LIVE' : weather.source === 'database' ? 'DB' : 'SIM'}
                  </span>
                )}
              </div>

              {/* Detail strip: feels like / humidity / wind / refresh */}
              {weather && !weatherLoading && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Thermometer size={13} style={{ color: '#F59E0B' }} />
                    Feels {weather.feelsLike}°C
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Droplets size={13} style={{ color: '#60a5fa' }} />
                    {weather.humidity}{weather.humidity !== '--' ? '%' : ''} humidity
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Wind size={13} style={{ color: '#a78bfa' }} />
                    {weather.windSpeed}{weather.windSpeed !== '--' ? ' m/s' : ''} wind
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchWeather(true, selectedDate, inputCity)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-accent)', fontSize: '12px',
                      padding: 0, marginLeft: 'auto', fontWeight: 600
                    }}
                  >
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
              )}
            </div>

            {/* Heatwave toggle */}
            <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '32px' }}>
              <div>
                <label className="input-label" style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: '16px' }}>Active Heatwave Flag</label>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Is there a declared heatwave in the region?</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={heatwaveFlag}
                  onChange={(e) => { setHeatwaveFlag(e.target.checked); setUserInteracted(true); }}
                />
                <span className="slider"></span>
              </label>
            </div>

            <button type="submit" className="btn" style={{ width: '100%', marginTop: '32px' }} disabled={loading || !temperature}>
              {loading ? 'Running Model...' : 'Generate Prediction'}
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>
        </div>

        {/* ── Right Panel: Results ── */}
        <div className="glass-panel border-top-green" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '24px' }}>Prediction Target</h2>

          {error && (
            <div style={{ background: 'rgba(255, 23, 68, 0.1)', border: '1px solid var(--color-bearish)', padding: '16px', borderRadius: '12px', color: 'var(--color-bearish)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <AlertTriangle size={24} />
              <div>
                <strong>Prediction Failed</strong>
                <p style={{ margin: 0, fontSize: '14px', marginTop: '4px' }}>{error}</p>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                  <circle cx="80" cy="80" r="70" fill="none" stroke="var(--glass-border)" strokeWidth="8" />
                  <circle cx="80" cy="80" r="70" fill="none" stroke="var(--color-accent)" strokeWidth="8"
                    strokeDasharray="440" strokeDashoffset={440 - (440 * progress) / 100}
                    style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))' }} strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'var(--font-secondary)', zIndex: 10 }}>{progress}%</span>
              </div>
              <p style={{ marginTop: '32px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Generating Neural Forecast...</p>
            </div>
          )}

          {!loading && !result && !error && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <TrendingUp size={32} opacity={0.5} />
              </div>
              <p>Awaiting parameters.</p>
              <p style={{ fontSize: '14px' }}>Live temperature is pre-filled — hit Generate to run the model.</p>
            </div>
          )}

          {!loading && result && (() => {
            const volatilityValue = result.volatility || 0.02; 
            const safeMin = result.prediction * (1 - volatilityValue);
            const safeMax = result.prediction * (1 + volatilityValue);
            const isPriceSpike = result.returnPct > 2.0;
            const isVolSpike = volatilityValue > 0.035;

            return (
              <div className="prediction-result animate-fade-up" style={{ marginTop: 'auto', marginBottom: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                  <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                    <circle cx="80" cy="80" r="70" fill="none" stroke="var(--glass-border)" strokeWidth="12" />
                    <circle cx="80" cy="80" r="70" fill="none" stroke={getConfidenceColor(result.confidence || 0)} strokeWidth="12"
                      strokeDasharray="440" strokeDashoffset={440 - (440 * (result.confidence || 0)) / 100}
                      style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }} strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'var(--font-secondary)', zIndex: 10, color: 'var(--color-text-primary)' }}>
                    {Math.round(result.confidence || 0)}%
                  </span>
                </div>

                <h3 style={{ fontSize: '24px', marginBottom: '24px' }}>
                  Trend is <span className={result.trend === 'Bullish' ? 'text-bullish' : result.trend === 'Bearish' ? 'text-bearish' : ''}>{result.trend}</span>
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', width: '100%', textAlign: 'left', marginBottom: '24px', background: 'var(--glass-bg)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Thermometer size={14} /> Temp
                    </div>
                    <div style={{ fontSize: '20px', color: 'var(--color-text-primary)' }}>
                      {parseFloat(temperature).toFixed(2)} °C
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={14} /> Predicted Close
                    </div>
                    <div style={{ fontSize: '20px', color: 'var(--color-text-primary)' }}>
                      &#8377; {(result.prediction || 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} /> Return
                    </div>
                    <div style={{ fontSize: '20px', color: result.returnPct >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                      {result.returnPct > 0 ? '+' : ''}{(result.returnPct || 0).toFixed(2)} %
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} /> Volatility <span style={{fontSize: '10px', opacity: 0.7}}>(Range: 0 to 1)</span>
                    </div>
                    <div style={{ fontSize: '20px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      {(result.volatility || 0).toFixed(4)}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: result.returnPct >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                      {result.returnPct >= 0 ? 'Low Risk (Stable, Min Range)' : 'High Risk (Unstable, Max Range)'}
                    </div>
                  </div>
                </div>

                <div style={{ color: 'var(--color-text-secondary)', width: '100%', textAlign: 'left', background: 'var(--glass-bg)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <p style={{ margin: 0, marginBottom: '12px', fontSize: '13px', lineHeight: '1.5' }}>
                    Based on Indian Energy Sector models, a temperature of <strong style={{ color: 'var(--color-text-primary)' }}>{temperature}&deg;C</strong> {heatwaveFlag ? 'during a heatwave' : ''} produces this estimated evaluation point.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', paddingTop: '12px', borderTop: '1px dashed var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>ML Safe Range:</strong></span>
                      <span style={{ color: 'var(--color-text-primary)' }}>&#8377;{safeMin.toFixed(2)} &mdash; &#8377;{safeMax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>Price Spike Predicted:</strong></span>
                      <span>{isPriceSpike ? <span style={{ color: 'var(--color-bullish)', fontWeight: 'bold' }}>Yes (Return &gt; 2%)</span> : 'No'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>High Volatility Warning:</strong></span>
                      <span>{isVolSpike ? <span style={{ color: 'var(--color-bearish)', fontWeight: 'bold' }}>Yes</span> : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Fundamentals Card (NEW) */}
                {result.fundamentals && !result.fundamentals.error && (
                  <div style={{ marginTop: '24px', width: '100%', textAlign: 'left', background: 'var(--glass-bg)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={16} style={{ color: '#3B82F6' }} /> Live Fundamentals
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Market Cap</span>
                        <span style={{ fontWeight: 500 }}>{result.fundamentals.marketCap != null ? `\u20B9${(result.fundamentals.marketCap / 1e9).toFixed(2)}B` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>P/E Ratio</span>
                        <span style={{ fontWeight: 500 }}>{result.fundamentals.peRatio != null ? result.fundamentals.peRatio.toFixed(2) : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Dividend Yield</span>
                        <span style={{ fontWeight: 500 }}>{result.fundamentals.dividendYield != null ? (result.fundamentals.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>52-Week Range</span>
                        <span style={{ fontWeight: 500 }}>{result.fundamentals.fiftyTwoWeekLow != null && result.fundamentals.fiftyTwoWeekHigh != null ? `\u20B9${result.fundamentals.fiftyTwoWeekLow} - \u20B9${result.fundamentals.fiftyTwoWeekHigh}` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* System Note (NEW) */}
                <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'center', opacity: 0.7 }}>
                   System Note: Predictions & fundamentals are computed by dual-model core engines and synced with Yahoo Finance APIs. Not an actual financial advice.
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default Prediction;
