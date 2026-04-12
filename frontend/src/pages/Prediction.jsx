import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowRight, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Thermometer, Activity } from 'lucide-react';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/stocks');
        setCompanies(res.data);
        const currentCid = companyId || (res.data.length > 0 ? res.data[0].id : null);
        if (!companyId && currentCid) {
          setCompanyId(currentCid);
        }
        setInitialLoading(false); // Only stop loading when data arrives
      } catch (err) {
        console.warn("Prediction: backend not ready, retrying...");
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

    // Simulate complex model processing progress
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
      // Artificial delay allowing users to enjoy the circular animation UX natively
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
    if (conf < 50) return '#EF4444'; // Red
    if (conf < 75) return '#F59E0B'; // Orange/Yellow
    return '#10B981'; // Green
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
              var(--glass-border) 25%,
              rgba(255,255,255,0.08) 50%,
              var(--glass-border) 75%
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
          {/* Left Panel Skeleton */}
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
          {/* Right Panel Skeleton */}
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
      <div className="page-header">
        <h1 className="page-title">Run ML Prediction</h1>
        <p className="page-subtitle">Input current regional climate factors to predict the effect on Energy sector stocks using our state-of-the-art XGBoost model.</p>
      </div>

      <div className="grid-2">
        <div className="glass-panel border-top-blue">
          <h2 style={{ marginBottom: '24px' }}>Input Parameters</h2>

          <form onSubmit={handlePredict}>
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

            <div className="input-group">
              <label className="input-label">Average Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                className="input-field"
                placeholder="e.g. 35.5"
                value={temperature}
                onChange={(e) => { setTemperature(e.target.value); setUserInteracted(true); }}
                required
              />
            </div>

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
              <p style={{ fontSize: '14px' }}>Enter temperature to see the AI forecasted trend.</p>
            </div>
          )}

          {!loading && result && (
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
                    ₹ {(result.prediction || 0).toFixed(2)}
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
                    <AlertTriangle size={14} /> Volatility
                  </div>
                  <div style={{ fontSize: '20px', color: 'var(--color-text-primary)' }}>
                    {(result.volatility || 0).toFixed(4)}
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px' }}>
                Based on Indian Energy Sector models, a temperature of <strong style={{ color: 'var(--color-text-primary)' }}>{temperature}°C</strong> {heatwaveFlag ? 'during a heatwave' : ''} produces this estimated evaluation point.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Prediction;
