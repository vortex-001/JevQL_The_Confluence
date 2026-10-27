import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { History, Trash2, Play, Clock, Zap, Search } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.getHistory();
      setHistory(res.history_records || []);
    } catch (err) {
      error(err.message || 'Failed to load query execution history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your entire query execution history log?')) {
      return;
    }

    setClearing(true);
    try {
      await api.clearHistory();
      setHistory([]);
      success('Query execution history log cleared.');
    } catch (err) {
      error(err.message || 'Failed to clear history log.');
    } finally {
      setClearing(false);
    }
  };

  const handleRerun = (queryText) => {
    navigate(`/app?q=${encodeURIComponent(queryText)}`);
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            Query Execution History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Audit log of executed natural-language queries, measured latency, record counts, and engine mode.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={clearing}
            className="btn-white"
            style={{ color: 'var(--status-negative)' }}
          >
            <Trash2 size={16} />
            <span>{clearing ? 'Clearing...' : 'Clear History Log'}</span>
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>QUERY</th>
                <th style={{ width: '150px' }}>DATA SOURCE</th>
                <th style={{ width: '180px' }}>ENGINE MODE</th>
                <th style={{ width: '100px' }}>MATCHES</th>
                <th style={{ width: '120px' }}>LATENCY</th>
                <th style={{ width: '160px' }}>EXECUTED AT</th>
                <th style={{ width: '120px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem' }}>
                    <div className="skeleton" style={{ height: '28px', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ height: '28px', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ height: '28px' }} />
                  </td>
                </tr>
              ) : history.length > 0 ? (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '340px' }}>
                        "{item.query_text}"
                      </div>
                    </td>
                    <td>
                      <span className="mono-pill">{item.source}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {item.search_mode}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
                        {item.result_count}
                      </span>
                    </td>
                    <td style={{ color: 'var(--status-positive)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {item.duration_ms} ms
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {item.executed_at || item.created_at}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleRerun(item.query_text)}
                        className="btn-primary"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Re-run</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⏱️</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      No Query History Recorded
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                      Queries executed through the Search Dashboard will automatically appear here with measured execution latencies.
                    </p>
                    <Link to="/app" className="btn-primary">
                      Execute a Query
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
