import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Database,
  Search,
  Bookmark,
  Zap,
  BarChart3,
  Network,
} from 'lucide-react';


export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  useEffect(() => {
    async function loadOverview() {
      try {
        const res = await api.getDashboardOverview();
        setData(res);
      } catch (err) {
        error(err.message || 'Failed to load executive dashboard overview.');
      } finally {
        setLoading(false);
      }
    }
    loadOverview();
  }, [error]);

  return (
    <div>
      {/* Page Title */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          Executive Database Overview
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          High-level metrics, database connectivity status, and query engine performance.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-circle orange">
            <Search size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : (data?.total_records ?? 0)}</div>
            <div className="metric-label">Dataset Records</div>
            <div className="metric-sub">Employee Feedback table</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle purple">
            <Database size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val" style={{ fontSize: '1.15rem', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data?.active_conn?.database || 'jevql_db'}
            </div>
            <div className="metric-label">Active Database</div>
            <div className="metric-sub">
              {data?.active_conn?.is_custom ? `Custom (${data?.active_conn?.active_table || 'active'})` : 'PostgreSQL'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle blue">
            <Bookmark size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : (data?.saved_count ?? 0)}</div>
            <div className="metric-label">Saved Queries</div>
            <div className="metric-sub">In query library</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle green">
            <Zap size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val" style={{ fontSize: '1.15rem' }}>
              {data?.provider_available ? 'Gemini Active' : 'pg_trgm Ready'}
            </div>
            <div className="metric-label">Semantic Engine</div>
            <div className="metric-sub">{data?.provider_name || 'Gemini Provider'}</div>
          </div>
        </div>
      </div>

      {!loading && (!data?.total_records || data.total_records === 0) && !data?.active_conn?.is_custom && (
        <div className="card" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '1.25rem 1.5rem',
          background: 'var(--bg-subtle)',
          borderLeft: '4px solid var(--primary-orange)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              No Dataset Available Yet
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Upload an employee feedback or custom CSV dataset, or connect an external PostgreSQL database to begin searching.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/app" className="btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
              Launch Search
            </Link>
            <Link to="/app/integrations" className="btn-white" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
              Connect Database
            </Link>
          </div>
        </div>
      )}

      {/* Main Overview Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.75rem',
        marginBottom: '2rem',
      }} className="overview-split">
        {/* Left: Recent Query Activity Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Recent Query Executions
            </h3>
            <Link to="/app/history" style={{ color: 'var(--primary-orange)', fontSize: '0.85rem', fontWeight: 600 }}>
              View All History →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>QUERY</th>
                  <th>MATCHES</th>
                  <th>LATENCY</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}>
                      <div className="skeleton" style={{ height: '30px', margin: '0.5rem 0' }} />
                      <div className="skeleton" style={{ height: '30px', margin: '0.5rem 0' }} />
                    </td>
                  </tr>
                ) : data?.recent_history?.length > 0 ? (
                  data.recent_history.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/app?q=${encodeURIComponent(item.query_text)}`} style={{ color: 'inherit' }}>
                          "{item.query_text}"
                        </Link>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
                          {item.result_count}
                        </span>
                      </td>
                      <td style={{ color: 'var(--status-positive)', fontWeight: 700 }}>
                        {item.duration_ms} ms
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {item.timestamp}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      No recent executions logged.{' '}
                      <Link to="/app" style={{ color: 'var(--primary-orange)', fontWeight: 600 }}>
                        Run your first search query
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Guardrails & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* System Health Card */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
              System Health & Guardrails
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>PostgreSQL Connection</span>
                <span className="badge badge-positive">Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Read-Only Transactions</span>
                <span className="badge badge-positive">Enforced</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Identifier Allowlist</span>
                <span className="badge badge-positive">Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Session Credentials</span>
                <span className="badge badge-positive">Signed</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card" style={{ background: 'var(--bg-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.85rem' }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <Link to="/app" className="btn-primary" style={{ justifyContent: 'center' }}>
                <Search size={16} />
                <span>Launch Search Dashboard</span>
              </Link>
              <Link to="/app/integrations" className="btn-white" style={{ justifyContent: 'center' }}>
                <Network size={16} />
                <span>Manage PostgreSQL Connections</span>
              </Link>
              <Link to="/app/analytics" className="btn-white" style={{ justifyContent: 'center' }}>
                <BarChart3 size={16} />
                <span>Deep-Dive Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .overview-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
