import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Thermometer, Flame, TrendingUp, TrendingDown,
  BarChart2, Activity, Zap, Target, RefreshCw, AlertTriangle
} from 'lucide-react';

/* ── tiny helper ──────────────────────────────────────────────── */
const fmt  = (v, d = 2) => (isNaN(v) || v === null ? '—' : Number(v).toFixed(d));
const fmtN = (v)        => (isNaN(v) || v === null ? '—' : Number(v).toLocaleString('en-IN'));

/* ── mini stat pill ───────────────────────────────────────────── */
const Pill = ({ label, value, color = 'var(--color-accent)' }) => (
  <div style={{
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
    borderRadius: '10px', padding: '10px 16px', textAlign: 'center'
  }}>
    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</div>
  </div>
);

/* ── horizontal bar ───────────────────────────────────────────── */
const Bar = ({ pct, color }) => (
  <div style={{ background: 'var(--glass-border)', borderRadius: '99px', height: '8px', overflow: 'hidden', marginTop: '8px' }}>
    <div style={{
      width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%',
      background: color, borderRadius: '99px',
      transition: 'width 1s cubic-bezier(0.25,0.8,0.25,1)'
    }} />
  </div>
);

/* ── impact badge ─────────────────────────────────────────────── */
const ImpactBadge = ({ pct }) => {
  if (pct === null || isNaN(pct)) return null;
  const positive = pct >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: positive ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)',
      color: positive ? 'var(--color-bullish)' : 'var(--color-bearish)',
      border: `1px solid ${positive ? 'var(--color-bullish)' : 'var(--color-bearish)'}`,
      borderRadius: '20px', padding: '3px 10px', fontSize: '13px', fontWeight: '600'
    }}>
      {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {positive ? '+' : ''}{fmt(pct, 2)}%
    </span>
  );
};

/* ════════════════════════════════════════════════════════════════
   Insights Page
════════════════════════════════════════════════════════════════ */
const Insights = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchInsights = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/insights?t=${Date.now()}`);
      setData(res.data);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      // Backend offline — keep skeleton showing, retry on next interval
      console.warn('Backend not ready, retrying…');
    }
  };

  useEffect(() => {
    fetchInsights();
    const id = setInterval(fetchInsights, 3000); // Hyper-dynamic update every 3s
    return () => clearInterval(id);
  }, []);

  /* ── loading skeleton (shown until backend responds) ──────── */
  if (loading) {
    return (
      <div className="insights">
        <style>{`
          @keyframes shimmer {
            0%   { background-position: -600px 0; }
            100% { background-position:  600px 0; }
          }
          .skeleton-line {
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
          <h1 className="page-title">Climate-Finance Insights</h1>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '8px' }}>
          {/* Skeleton card shapes matching the real cards */}
          {[
            { titleW: '38%', lines: ['72%', '90%', '55%'] },
            { titleW: '42%', lines: ['80%', '68%'] },
            { titleW: '50%', lines: ['85%', '75%', '60%'] },
            { titleW: '35%', lines: ['70%', '88%'] },
            { titleW: '45%', lines: ['78%', '65%', '82%'] },
          ].map((card, i) => (
            <div key={i} className="glass-panel" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {/* icon placeholder */}
              <div className="skeleton-line" style={{ width: '58px', height: '58px', borderRadius: '14px', flexShrink: 0 }} />
              <div style={{ flex: 1, paddingTop: '4px' }}>
                {/* title */}
                <div className="skeleton-line" style={{ width: card.titleW, height: '16px', marginBottom: '14px' }} />
                {/* body lines */}
                {card.lines.map((w, j) => (
                  <div key={j} className="skeleton-line" style={{ width: w, height: '11px', marginBottom: '10px' }} />
                ))}
                {/* pill row */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  {[1, 2, 3, 4].map(p => (
                    <div key={p} className="skeleton-line" style={{ flex: 1, height: '54px', borderRadius: '10px' }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  const { temperature: T, stockPrice: S, predictions: P } = data || {};

  /* Prediction trend % shares */
  const predTotal = P?.total || 1;
  const bullPct = ((P?.bullish / predTotal) * 100) || 0;
  const bearPct = ((P?.bearish / predTotal) * 100) || 0;
  const neutPct = ((P?.neutral / predTotal) * 100) || 0;

  return (
    <div className="insights">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Climate-Finance Insights</h1>
          <p className="page-subtitle">
            Live findings from&nbsp;<strong style={{ color: 'var(--color-text-primary)' }}>{fmtN(T?.totalDays)}</strong>&nbsp;
            climate records linked to Indian energy sector stock performance.
          </p>
        </div>
        {lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
            <RefreshCw size={12} />
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '8px' }}>

        {/* ══ CARD 1 — Temperature Overview ═══════════════════ */}
        <div className="glass-panel border-top-blue">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(26,86,219,0.12)', padding: '14px', borderRadius: '14px', color: '#1A56DB', flexShrink: 0 }}>
              <Thermometer size={30} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>🌡️ Temperature Overview</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                Across <strong style={{ color: 'var(--color-text-primary)' }}>{fmtN(T?.totalDays)}</strong> recorded days —
                average&nbsp;<strong style={{ color: '#1A56DB' }}>{fmt(T?.avg, 1)}°C</strong>,
                peak&nbsp;<strong style={{ color: '#D97706' }}>{fmt(T?.max, 1)}°C</strong>,
                low&nbsp;<strong style={{ color: '#059669' }}>{fmt(T?.min, 1)}°C</strong>.
                Temp std-dev: <strong style={{ color: 'var(--color-text-primary)' }}>{fmt(T?.stddev, 2)}°C</strong>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <Pill label="Avg Temp"      value={`${fmt(T?.avg, 1)}°C`}  color="#1A56DB" />
                <Pill label="Peak Temp"     value={`${fmt(T?.max, 1)}°C`}  color="#D97706" />
                <Pill label="Min Temp"      value={`${fmt(T?.min, 1)}°C`}  color="#059669" />
                <Pill label="Std Deviation" value={`${fmt(T?.stddev, 2)}°C`} color="var(--color-text-primary)" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ CARD 2 — Heatwave Frequency ═════════════════════ */}
        <div className="glass-panel border-top-orange">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(217,119,6,0.12)', padding: '14px', borderRadius: '14px', color: '#D97706', flexShrink: 0 }}>
              <Flame size={30} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>🔥 Heatwave Frequency Analysis</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                <strong style={{ color: '#D97706' }}>{fmtN(T?.heatwaveDays)} heatwave days</strong> detected
                out of <strong style={{ color: 'var(--color-text-primary)' }}>{fmtN(T?.totalDays)}</strong> total —
                that's <strong style={{ color: T?.heatwaveRatioPct > 20 ? '#D97706' : 'var(--color-bullish)' }}>
                  {fmt(T?.heatwaveRatioPct, 1)}%
                </strong> of the dataset.
                {T?.heatwaveRatioPct > 20
                  ? ' High heatwave frequency indicates elevated climate risk for the energy sector.'
                  : ' Heatwave frequency is within manageable range for energy sector stocks.'}
              </p>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  <span>🌡️ Heatwave days — {fmtN(T?.heatwaveDays)}</span>
                  <span>{fmt(T?.heatwaveRatioPct, 1)}%</span>
                </div>
                <Bar pct={T?.heatwaveRatioPct} color="#D97706" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  <span>☀️ Normal days — {fmtN(T?.normalDays)}</span>
                  <span>{fmt(100 - T?.heatwaveRatioPct, 1)}%</span>
                </div>
                <Bar pct={100 - T?.heatwaveRatioPct} color="#059669" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ CARD 3 — Heatwave Stock Price Impact ════════════ */}
        <div className="glass-panel border-top-green">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(5,150,105,0.12)', padding: '14px', borderRadius: '14px', color: '#059669', flexShrink: 0 }}>
              <Activity size={30} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '18px' }}>📈 Heatwave vs Normal Stock Price</h3>
                <ImpactBadge pct={S?.heatwaveImpactPct} />
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                During heatwave days, avg price is&nbsp;
                <strong style={{ color: S?.heatwaveImpactPct >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                  ₹{fmt(S?.avgHeatwave, 2)}
                </strong>
                &nbsp;vs ₹{fmt(S?.avgNormal, 2)} on normal days.
                This&nbsp;
                <strong style={{ color: S?.heatwaveImpactPct >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                  {S?.heatwaveImpactPct >= 0 ? 'bullish' : 'bearish'} {fmt(Math.abs(S?.heatwaveImpactPct), 2)}% differential
                </strong>
                &nbsp;reflects real climate-finance correlation computed from {fmtN(T?.totalDays)} joined records.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <Pill label="Avg (All days)"     value={`₹${fmt(S?.avgAll, 2)}`}      color="var(--color-text-primary)" />
                <Pill label="Avg (Heatwave)"     value={`₹${fmt(S?.avgHeatwave, 2)}`} color="#D97706" />
                <Pill label="Avg (Normal)"       value={`₹${fmt(S?.avgNormal, 2)}`}   color="#059669" />
                <Pill label="Price Range"        value={`₹${fmt(S?.min, 0)} – ₹${fmt(S?.max, 0)}`} color="var(--color-accent)" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ CARD 4 — High-Temp Correlation ══════════════════ */}
        <div className="glass-panel" style={{ borderTop: '4px solid #6366F1' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(99,102,241,0.12)', padding: '14px', borderRadius: '14px', color: '#6366F1', flexShrink: 0 }}>
              <Zap size={30} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '18px' }}>⚡ Above-Avg Temp vs Stock Price</h3>
                <ImpactBadge pct={S?.highTempImpactPct} />
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
                When temperature exceeds the dataset average of&nbsp;
                <strong style={{ color: '#6366F1' }}>{fmt(T?.avg, 1)}°C</strong>,
                stock prices move&nbsp;
                <strong style={{ color: S?.highTempImpactPct >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                  {S?.highTempImpactPct >= 0 ? '+' : ''}{fmt(S?.highTempImpactPct, 2)}%
                </strong>
                &nbsp;compared to cooler days. Price volatility (coefficient of variation)
                stands at <strong style={{ color: 'var(--color-warning)' }}>{fmt(S?.volatilityPct, 2)}%</strong>.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <Pill label="High-Temp Impact" value={<ImpactBadge pct={S?.highTempImpactPct} />} />
                <Pill label="Price Volatility" value={`${fmt(S?.volatilityPct, 2)}%`} color="var(--color-warning)" />
                <Pill label="Price Std Dev"    value={`₹${fmt(S?.stddev, 2)}`}         color="var(--color-text-secondary)" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ CARD 5 — ML Prediction Stats ════════════════════ */}
        <div className="glass-panel" style={{ borderTop: `4px solid ${P?.total > 0 ? '#06B6D4' : 'var(--glass-border)'}` }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(6,182,212,0.12)', padding: '14px', borderRadius: '14px', color: '#06B6D4', flexShrink: 0 }}>
              <Target size={30} />
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>🤖 ML Prediction History</h3>

              {P?.total === 0 ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--color-text-secondary)', padding: '16px 0' }}>
                  <AlertTriangle size={18} />
                  No predictions have been run yet. Go to the <strong style={{ color: 'var(--color-text-primary)' }}>Prediction</strong> page to generate your first forecast.
                </div>
              ) : (
                <>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{fmtN(P?.total)}</strong> predictions logged —
                    avg confidence <strong style={{ color: '#06B6D4' }}>{fmt(P?.avgConfidence, 1)}%</strong>,
                    avg input temperature <strong style={{ color: '#6366F1' }}>{fmt(P?.avgInputTemp, 1)}°C</strong>.
                  </p>

                  {/* Trend breakdown bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-bullish)' }}>🟢 Bullish — {fmtN(P?.bullish)}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{fmt(bullPct, 1)}%</span>
                      </div>
                      <Bar pct={bullPct} color="var(--color-bullish)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-bearish)' }}>🔴 Bearish — {fmtN(P?.bearish)}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{fmt(bearPct, 1)}%</span>
                      </div>
                      <Bar pct={bearPct} color="var(--color-bearish)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-warning)' }}>🟡 Neutral — {fmtN(P?.neutral)}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{fmt(neutPct, 1)}%</span>
                      </div>
                      <Bar pct={neutPct} color="var(--color-warning)" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <Pill label="Total Predictions"  value={fmtN(P?.total)}                    color="var(--color-text-primary)" />
                    <Pill label="Avg Confidence"     value={`${fmt(P?.avgConfidence, 1)}%`}    color="#06B6D4" />
                    <Pill label="Peak Confidence"    value={`${fmt(P?.maxConfidence, 1)}%`}    color="var(--color-bullish)" />
                    <Pill label="Avg Input Temp"     value={`${fmt(P?.avgInputTemp, 1)}°C`}    color="#6366F1" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Insights;
