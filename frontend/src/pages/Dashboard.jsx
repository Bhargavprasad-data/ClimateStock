import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Thermometer, Activity, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [climateSummary, setClimateSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    avgTemp: 0,
    latestPrice: 0,
    riskScore: 0
  });
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/dashboard');
        const dbData = response.data;
        setData(dbData);
        setLoading(false); // ← only stop skeleton when real data arrives

        if (dbData.length > 0) {
          const avgT = dbData.reduce((acc, curr) => acc + curr.temperature, 0) / dbData.length;
          const latestP = dbData[dbData.length - 1].stockPrice || 0;
          
          // Calculate dynamic correlation risk
          let calculatedRisk = 4.0 + (Math.max(0, avgT - 30) * 0.4);
          calculatedRisk = Math.min(10.0, Math.max(1.0, calculatedRisk));

          setMetrics({
            avgTemp: avgT.toFixed(1),
            latestPrice: latestP.toFixed(2),
            riskScore: calculatedRisk.toFixed(1)
          });
        }
      } catch (err) {
        // Backend offline — keep skeleton showing, retry on next interval
        console.warn('Dashboard: backend not ready, retrying…');
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 8000);
    return () => clearInterval(intervalId);
  }, []);

  // Fetch full-table climate summary for accurate pie chart
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/climate-summary');
        setClimateSummary(res.data);
      } catch (err) {
        console.error('Error fetching climate summary', err);
      }
    };
    fetchSummary();
    const summaryInterval = setInterval(fetchSummary, 30000); // refresh every 30s
    return () => clearInterval(summaryInterval);
  }, []);

  // Use full-table counts ONLY when real data is available
  const hasRealData    = climateSummary !== null;
  const heatwaveCount  = hasRealData ? (climateSummary.heatwave_days || 0) : 0;
  const normalCount    = hasRealData ? (climateSummary.normal_days   || 0) : 0;
  const totalRecords   = hasRealData ? (climateSummary.total_records || 0) : 0;

  // Only build meaningful pie data when backend has responded
  const pieData = hasRealData
    ? [
        { name: 'Normal Days',     value: normalCount   || 1 },
        { name: 'Heatwave Alerts', value: heatwaveCount || 0 }
      ]
    : [];
  const PIE_COLORS = ['#1A56DB', '#D97706'];

  // Dominant slice — only computed when real data present
  const domSlice      = hasRealData && pieData.length
    ? pieData.reduce((prev, curr) => (prev.value > curr.value) ? prev : curr)
    : null;
  const domPercentage = hasRealData && domSlice && totalRecords > 0
    ? ((domSlice.value / totalRecords) * 100).toFixed(0)
    : null;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      if (payload.length >= 2) {
        return (
          <div className="custom-tooltip">
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
            <p style={{ margin: 0, color: 'var(--color-accent)' }}>
              Temperature: {payload[0].value}°C
            </p>
            <p style={{ margin: 0, color: '#00E676' }}>
              Stock Price: ₹{payload[1].value}
            </p>
          </div>
        );
      } else {
        return (
          <div className="custom-tooltip">
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{payload[0].name}</p>
            <p style={{ margin: 0, color: 'var(--color-accent)' }}>
              Total: {payload[0].value}
            </p>
          </div>
        );
      }
    }
    return null;
  };

  /* ── shimmer skeleton (shown until backend responds) ─────── */
  if (loading) {
    return (
      <div className="dashboard">
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

        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Market Overview</h1>
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

        {/* 3 stat card skeletons */}
        <div className="grid-3" style={{ marginTop: '32px' }}>
          {['blue', 'orange', 'green'].map((color, i) => (
            <div key={i} className={`stat-card ${color}`} style={{ gap: '20px', alignItems: 'center' }}>
              <div className="sk" style={{ width: '64px', height: '64px', borderRadius: '16px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="sk" style={{ width: '60%', height: '11px', marginBottom: '12px' }} />
                <div className="sk" style={{ width: '45%', height: '28px', marginBottom: '10px' }} />
                <div className="sk" style={{ width: '70%', height: '10px' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Chart panel skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '32px' }}>
          {/* Area chart skeleton */}
          <div className="glass-panel">
            <div className="sk" style={{ width: '55%', height: '18px', marginBottom: '24px' }} />
            <div className="sk" style={{ width: '100%', height: '350px', borderRadius: '12px' }} />
          </div>
          {/* Pie chart skeleton */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="sk" style={{ width: '50%', height: '18px', marginBottom: '12px' }} />
            <div className="sk" style={{ width: '40%', height: '11px', marginBottom: '24px' }} />
            {/* Donut ring skeleton */}
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ marginTop: '16px' }}>
              <circle cx="110" cy="110" r="90"
                fill="none"
                stroke="var(--glass-border)"
                strokeWidth="30"
              />
            </svg>
            <div className="sk" style={{ width: '60%', height: '11px', marginTop: '16px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Market Overview</h1>
        <p className="page-subtitle">Analyze the historical impact of regional temperatures on energy stocks.</p>
      </div>

      <div className="grid-3" style={{ marginTop: '32px' }}>
        <div className="stat-card blue">
          <div className="icon-wrapper">
             <Thermometer size={32} />
          </div>
          <div className="info">
             <div className="title">Avg Temp (30d)</div>
             <div className="value">{metrics.avgTemp}°C</div>
             <div className="subtitle">Based on DB Records</div>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="icon-wrapper">
             <Activity size={32} />
          </div>
          <div className="info">
             <div className="title">Reliance Energy</div>
             <div className="value">₹{metrics.latestPrice}</div>
             <div className="subtitle">Latest Logged Price</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="icon-wrapper">
             <TrendingUp size={32} />
          </div>
          <div className="info">
             <div className="title">Climate Risk Score</div>
             <div className="value">{metrics.riskScore || '0.0'}</div>
             <div className="subtitle">Calculated from Temp Avg</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '32px' }}>
        <div className="glass-panel">
          <h2 style={{ marginBottom: '24px' }}>Temperature vs Energy Stock Price</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 60, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-bullish)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-bullish)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--color-text-secondary)" tick={{ fill: 'var(--color-text-secondary)' }} />
                <YAxis yAxisId="left" stroke="var(--color-text-secondary)" tick={{ fill: 'var(--color-text-secondary)' }} domain={['dataMin - 2', 'dataMax + 2']} unit="°C" label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', offset: 10, style: { fill: 'var(--color-text-secondary)', fontSize: '12px' } }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-text-secondary)" tick={{ fill: 'var(--color-text-secondary)' }} domain={['dataMin - 50', 'dataMax + 50']} unit="₹" label={{ value: 'Price (₹)', angle: 90, position: 'insideRight', offset: 10, style: { fill: 'var(--color-text-secondary)', fontSize: '12px' } }} />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="temperature" stroke="var(--color-accent)" fillOpacity={1} fill="url(#colorTemp)" />
                <Area yAxisId="right" type="monotone" dataKey="stockPrice" stroke="var(--color-bullish)" fillOpacity={1} fill="url(#colorStock)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel">
          <h2 style={{ marginBottom: '8px', textAlign: 'center' }}>Climate Events</h2>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            {hasRealData ? `${totalRecords.toLocaleString()} total records` : 'Connecting to database…'}
          </p>
          <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* ── No data yet: show spinner placeholder ── */}
            {!hasRealData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--color-text-secondary)' }}>
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="var(--glass-border)" strokeWidth="12" />
                </svg>
                <p style={{ fontSize: '13px', marginTop: '-140px' }}>Awaiting data…</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>

                  {domPercentage !== null && (
                    <>
                      <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '42px', fontWeight: '800', fill: 'var(--color-text-primary)', fontFamily: 'var(--font-secondary)' }}>
                        {domPercentage}%
                      </text>
                      <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: '14px', fill: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        {domSlice.name}
                      </text>
                    </>
                  )}

                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'var(--color-text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
