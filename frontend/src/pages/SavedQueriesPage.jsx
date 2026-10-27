import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Plus, Trash2, Play } from 'lucide-react';

export default function SavedQueriesPage() {
  const [savedQueries, setSavedQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const { success, error } = useToast();

  const navigate = useNavigate();

  const loadQueries = async () => {
    setLoading(true);
    try {
      const res = await api.getSavedQueries();
      setSavedQueries(res.saved_queries || []);
    } catch (err) {
      error(err.message || 'Failed to load saved queries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueries();
  }, []);

  const handleDelete = async (queryId, name) => {
    if (!window.confirm(`Are you sure you want to remove saved query "${name}"?`)) {
      return;
    }

    setDeletingId(queryId);
    try {
      await api.deleteSavedQuery(queryId);
      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
      success(`Query "${name}" removed from library.`);
    } catch (err) {
      error(err.message || 'Failed to remove saved query.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRunQuery = (item) => {
    const params = new URLSearchParams();
    if (item.query_text) params.set('q', item.query_text);

    if (item.filters) {
      if (Array.isArray(item.filters.dept)) {
        item.filters.dept.forEach((d) => params.append('dept', d));
      } else if (item.filters.dept) {
        params.set('dept', item.filters.dept);
      }

      if (Array.isArray(item.filters.sentiment)) {
        item.filters.sentiment.forEach((s) => params.append('sentiment', s));
      } else if (item.filters.sentiment) {
        params.set('sentiment', item.filters.sentiment);
      }

      if (item.filters.rating) {
        params.set('rating', item.filters.rating);
      }
    }

    navigate(`/app?${params.toString()}`);
  };

  return (
    <div>
      {/* Page Header */}
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
            Saved Query Library
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Bookmark complex natural-language queries, review applied filters, and run them with one click.
          </p>
        </div>

        <Link to="/app" className="btn-primary">
          <Plus size={16} />
          <span>New Search Query</span>
        </Link>
      </div>

      {/* Main Content Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>QUERY NAME</th>
                <th>NATURAL LANGUAGE QUERY</th>
                <th style={{ width: '220px' }}>SAVED FILTERS</th>
                <th style={{ width: '150px' }}>DATE SAVED</th>
                <th style={{ width: '160px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem' }}>
                    <div className="skeleton" style={{ height: '28px', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ height: '28px', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ height: '28px' }} />
                  </td>
                </tr>
              ) : savedQueries.length > 0 ? (
                savedQueries.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {item.name}
                    </td>
                    <td>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '380px' }}>
                        "{item.query_text}"
                      </div>
                    </td>
                    <td>
                      {item.filters && Object.keys(item.filters).some((k) => item.filters[k]) ? (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {Object.entries(item.filters).map(([k, v]) => {
                            if (!v || (Array.isArray(v) && v.length === 0)) return null;
                            return (
                              <span key={k} className="mono-pill">
                                {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      {item.created_at}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRunQuery(item)}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                        >
                          <Play size={12} fill="currentColor" />
                          <span>Run Query</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.name)}
                          disabled={deletingId === item.id}
                          className="btn-white"
                          style={{ padding: '0.4rem 0.65rem', color: 'var(--status-negative)' }}
                          title="Delete saved query"
                          aria-label={`Delete query ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔖</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      No Saved Queries Yet
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                      When you run searches in the Search Dashboard, click the "Save Query" button on the tabs bar to bookmark them here.
                    </p>
                    <Link to="/app" className="btn-primary">
                      Go to Search Dashboard
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
