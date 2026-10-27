import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp,
  Smile,
  Frown,
  Building,
} from 'lucide-react';


export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await api.getAnalyticsOverview();
        setData(res);
      } catch (err) {
        error(err.message || 'Failed to load deep-dive analytics.');
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [error]);

  const total = data?.total_records || 1;
  const posCount = data?.sentiment_counts?.Positive || 0;
  const neuCount = data?.sentiment_counts?.Neutral || 0;
  const negCount = data?.sentiment_counts?.Negative || 0;

  const posPct = Math.round((posCount / total) * 100);
  const neuPct = Math.round((neuCount / total) * 100);
  const negPct = Math.round((negCount / total) * 100);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          Insights & Deep-Dive Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Aggregated sentiment distributions, department workload breakdowns, and extracted themes across all {data?.total_records || 0} database records.
        </p>
      </div>

      {!loading && (!data?.total_records || data.total_records === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: '4.5rem 2rem', marginTop: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            No Dataset Available for Analytics
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            Connect a PostgreSQL database or upload a CSV dataset to generate live sentiment breakdowns, department distributions, and themes.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/app" className="btn-primary">
              Search Console
            </Link>
            <Link to="/app/integrations" className="btn-white">
              Connect Database
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 4 Stat Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-circle orange">
            <TrendingUp size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : (data?.total_records ?? 0)}</div>
            <div className="metric-label">Total Submissions</div>
            <div className="metric-sub">Employee feedback records</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle green">
            <Smile size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : posCount}</div>
            <div className="metric-label">Positive Feedback</div>
            <div className="metric-sub">{posPct}% satisfaction rate</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ background: 'var(--status-negative-bg)', color: 'var(--status-negative)' }}>
            <Frown size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val" style={{ color: 'var(--status-negative)' }}>{loading ? '-' : negCount}</div>
            <div className="metric-label">Negative Sentiment</div>
            <div className="metric-sub">{negPct}% burnout & friction alerts</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle purple">
            <Building size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : (data?.dept_distribution?.length ?? 0)}</div>
            <div className="metric-label">Departments</div>
            <div className="metric-sub">Active organizational units</div>
          </div>
        </div>
      </div>

      {/* Grid 1: Sentiment Breakdown & Rating Distribution */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.75rem',
        marginBottom: '2rem',
      }}>
        {/* Sentiment Bars */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
            Overall Sentiment Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--status-positive)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-positive)' }} />
                  Positive Sentiment
                </span>
                <span>{posCount} records ({posPct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${posPct}%`, height: '100%', background: 'var(--status-positive)', transition: 'width 0.4s' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--status-neutral)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-neutral)' }} />
                  Neutral Sentiment
                </span>
                <span>{neuCount} records ({neuPct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${neuPct}%`, height: '100%', background: 'var(--status-neutral)', transition: 'width 0.4s' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--status-negative)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-negative)' }} />
                  Negative Sentiment
                </span>
                <span>{negCount} records ({negPct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${negPct}%`, height: '100%', background: 'var(--status-negative)', transition: 'width 0.4s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Ratings 1-5 Star Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem' }}>
            Rating Distribution (1 - 5 Stars)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(data?.rating_counts || [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: 0 }))).map((r) => {
              const pct = Math.round((r.count / total) * 100);
              return (
                <div key={r.rating} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.88rem' }}>
                  <span style={{ width: '55px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {r.rating} ★
                  </span>
                  <div style={{ flex: 1, height: '9px', background: 'var(--bg-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-orange)', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ width: '45px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
                    {r.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid 2: Submissions by Department & Top Extracted Themes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.75rem',
      }}>
        {/* Department Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Submissions by Department
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>DEPARTMENT</th>
                <th style={{ width: '90px' }}>COUNT</th>
                <th style={{ width: '130px', textAlign: 'right' }}>EXPLORE</th>
              </tr>
            </thead>
            <tbody>
              {data?.dept_distribution?.map((d) => (
                <tr key={d.dept}>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.dept}</td>
                  <td>
                    <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
                      {d.count}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/app?dept=${encodeURIComponent(d.dept)}`}
                      style={{ color: 'var(--primary-orange)', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      Search →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Themes */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
            Extracted Feedback Themes
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Common topics identified across quarterly surveys:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {data?.theme_counts?.map((theme, idx) => (
              <Link
                key={idx}
                to={`/app?q=${encodeURIComponent(theme.name)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                className="chip-btn"
              >
                <span>#{theme.name}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-orange)' }}>({theme.count})</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
