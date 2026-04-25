import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, BarChart2 } from 'lucide-react';

const Returns = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(1);
  const [period, setPeriod] = useState('1m');
  const [chartData, setChartData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch companies for the dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/stocks');
        setCompanies(res.data);
        if (res.data.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(res.data[0].id);
        }
        setInitialLoading(false);
      } catch (err) {
        console.warn('Returns: backend not ready, retrying...');
      }
    };
    fetchCompanies();
    const intervalId = setInterval(fetchCompanies, 8000);
    return () => clearInterval(intervalId);
  }, [selectedCompanyId]);

  // Fetch historical stock data when company or period changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoading(true);
    axios.get(`http://localhost:5000/api/stock-history?company_id=${selectedCompanyId}&period=${period}`)
      .then(res => {
        setChartData(res.data.data || []);
        setMetrics(res.data.metrics || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stock history', err);
        setLoading(false);
      });
  }, [selectedCompanyId, period]);

  const selectedCompany = companies.find(c => c.id === parseInt(selectedCompanyId));
  const activeCompanyName = selectedCompany ? selectedCompany.name : '...';
  const activeCompanySymbol = selectedCompany ? selectedCompany.symbol : '...';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{ minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
             <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)' }}></span>
             <strong style={{ fontSize: '14px' }}>{activeCompanySymbol}</strong>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
            ₹{dataPoint.close.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            {dataPoint.fullDate}
          </div>
        </div>
      );
    }
    return null;
  };

  const isUp = metrics && metrics.priceChange >= 0;

  return (
    <div className="returns-page animate-fade-up">
      <style>{`
        .header-metrics {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 24px;
        }
        .main-price-block {
          display: flex;
          flex-direction: column;
        }
        .symbol-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-accent);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .price-large {
          font-size: 48px;
          font-weight: 800;
          font-family: var(--font-secondary);
          line-height: 1.1;
          margin-top: 4px;
        }
        .change-large {
          font-size: 18px;
          font-weight: 600;
          margin-top: 4px;
        }
        .ohlc-grid {
          display: flex;
          gap: 32px;
          margin-top: 12px;
        }
        .ohlc-item {
          display: flex;
          flex-direction: column;
        }
        .ohlc-label {
          font-size: 13px;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .ohlc-value {
          font-size: 18px;
          font-weight: 600;
          font-family: var(--font-secondary);
        }
        .period-selector {
          display: inline-flex;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 4px;
          gap: 4px;
        }
        .period-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .period-btn:hover {
          color: var(--color-text-primary);
          background: rgba(255, 255, 255, 0.05);
        }
        .period-btn.active {
          background: var(--color-accent);
          color: #000;
          box-shadow: 0 2px 8px rgba(0, 240, 255, 0.2);
        }
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

      {initialLoading ? (
        <>
          <div className="page-header">
            <h1 className="page-title">Company Returns</h1>
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
          
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div>
              <div className="header-metrics">
                <div className="main-price-block">
                  <div className="sk" style={{ width: '120px', height: '28px', marginBottom: '8px' }} />
                  <div className="sk" style={{ width: '180px', height: '54px', marginBottom: '8px' }} />
                  <div className="sk" style={{ width: '150px', height: '22px' }} />
                </div>
                <div className="ohlc-grid">
                  {[1,2,3].map(i => (
                    <div key={i} className="ohlc-item">
                      <div className="sk" style={{ width: '60px', height: '15px', marginBottom: '6px' }} />
                      <div className="sk" style={{ width: '80px', height: '22px' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', marginBottom: '24px' }}>
                <div className="sk" style={{ width: '250px', height: '34px', borderRadius: '8px' }} />
              </div>
              <div className="sk" style={{ width: '100%', height: '400px', borderRadius: '12px' }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">Company Returns</h1>
              <p className="page-subtitle">Track historical performance and returns for specific energy stocks.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Select Company:</label>
              <select 
                value={selectedCompanyId} 
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="input-field"
                style={{ width: '220px', padding: '10px 14px', cursor: 'pointer' }}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.symbol} ({c.name})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '32px' }}>
        {loading ? (
          <div>
            <div className="header-metrics">
              <div className="main-price-block">
                <div className="sk" style={{ width: '120px', height: '28px', marginBottom: '8px' }} />
                <div className="sk" style={{ width: '180px', height: '54px', marginBottom: '8px' }} />
                <div className="sk" style={{ width: '150px', height: '22px' }} />
              </div>
              <div className="ohlc-grid">
                {[1,2,3].map(i => (
                  <div key={i} className="ohlc-item">
                    <div className="sk" style={{ width: '60px', height: '15px', marginBottom: '6px' }} />
                    <div className="sk" style={{ width: '80px', height: '22px' }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', marginBottom: '24px' }}>
              <div className="sk" style={{ width: '250px', height: '34px', borderRadius: '8px' }} />
            </div>
            <div className="sk" style={{ width: '100%', height: '400px', borderRadius: '12px' }} />
          </div>
        ) : metrics ? (
          <>
            <div className="header-metrics">
              <div className="main-price-block">
                <div className="symbol-title">
                  {activeCompanySymbol} <TrendingUp size={20} />
                </div>
                <div className="price-large">
                  {metrics.latestPrice.toFixed(2)}
                </div>
                <div className={`change-large ${isUp ? 'text-bullish' : 'text-bearish'}`}>
                  {isUp ? '+' : ''}{metrics.priceChange.toFixed(2)} ({isUp ? '+' : ''}{metrics.returnPct.toFixed(2)}%)
                </div>
              </div>

              <div className="ohlc-grid">
                <div className="ohlc-item">
                  <div className="ohlc-label"><span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#6366F1'}}></span> Open</div>
                  <div className="ohlc-value">{metrics.open.toFixed(2)}</div>
                </div>
                <div className="ohlc-item">
                  <div className="ohlc-label"><span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#10B981'}}></span> High</div>
                  <div className="ohlc-value">{metrics.high.toFixed(2)}</div>
                </div>
                <div className="ohlc-item">
                  <div className="ohlc-label"><span style={{width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444'}}></span> Low</div>
                  <div className="ohlc-value">{metrics.low.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', marginBottom: '24px' }}>
              <div className="period-selector">
                {['1d', '1m', '3m', '6m', '1y'].map(p => (
                  <button 
                    key={p} 
                    className={`period-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-container" style={{ height: '400px', marginTop: '0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? 'var(--color-bullish)' : 'var(--color-bearish)'} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={isUp ? 'var(--color-bullish)' : 'var(--color-bearish)'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="dateStr" 
                    stroke="var(--color-text-secondary)" 
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
                    minTickGap={30}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={['dataMin - (dataMax-dataMin)*0.1', 'dataMax + (dataMax-dataMin)*0.1']} 
                    stroke="var(--color-text-secondary)" 
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val.toFixed(0)}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke={isUp ? 'var(--color-bullish)' : 'var(--color-bearish)'} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorReturn)" 
                    connectNulls 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px' }}>
            No data available for the selected period.
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
};

export default Returns;
