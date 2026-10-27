import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, CheckCircle2, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const { error } = useToast();


  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.getSettings();
        setData(res);
      } catch (err) {
        error(err.message || 'Failed to load developer settings.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [error]);

  const dbConf = data?.db_conf;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          Settings & Engine Status
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Database connection parameters, semantic provider configuration, and security guardrails.
        </p>
      </div>

      {/* 2 Main Cards: Database Config & Semantic Engine */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.75rem',
        marginBottom: '2rem',
      }}>
        {/* Database Config */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Database Configuration</h3>
            <span className="badge badge-positive">Connected</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: '150px', color: 'var(--text-secondary)' }}>Database Engine</td>
                <td>
                  <code>{dbConf?.ENGINE || 'django.db.backends.postgresql'}</code>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Target Database</td>
                <td><strong>{dbConf?.NAME || 'jevql_db'}</strong></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Host & Port</td>
                <td><code>{dbConf?.HOST || 'localhost'}:{dbConf?.PORT || 5432}</code></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Configured User</td>
                <td><code>{dbConf?.USER || 'postgres'}</code></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Credentials Masking</td>
                <td>
                  <span className="badge" style={{ background: 'var(--bg-subtle)' }}>
                    Zero Credential Leakage
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Semantic Provider Config */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Semantic Search Provider</h3>
            <span className={`badge ${data?.has_gemini_key ? 'badge-positive' : 'badge-neutral'}`}>
              {data?.has_gemini_key ? 'Gemini Active' : 'Local Trigram Mode'}
            </span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: '160px', color: 'var(--text-secondary)' }}>Active Provider</td>
                <td><strong>{data?.provider_name || 'Gemini Provider'}</strong></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Gemini API Key</td>
                <td>
                  {data?.has_gemini_key ? (
                    <span style={{ color: 'var(--status-positive)', fontWeight: 600 }}>Configured (GEMINI_API_KEY)</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>None (Fallback to PostgreSQL Trigram)</span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Timeout Threshold</td>
                <td><code>{data?.timeout_seconds || 5.0}s</code> per candidate batch</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Max Candidates</td>
                <td><code>{data?.candidate_limit || 30}</code> records evaluated per query</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Paid Extensions</td>
                <td>
                  <span className="badge badge-positive">None (100% Free Open-Source pg_trgm)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety & Architecture Guardrails */}
      <div className="card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
          Safety & Architecture Guardrails
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
          fontSize: '0.88rem',
        }}>
          <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="var(--status-positive)" />
              1. Read-Only Transactions
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              All custom SQL and ORM queries are executed with explicit read-only transactions, preventing DROP, UPDATE, or DELETE operations.
            </p>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="var(--status-positive)" />
              2. Identifier Allowlist
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              All table and schema names are validated against system catalog tables and safely quoted using <code>quote_ident</code> to eliminate SQL injection risks.
            </p>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="var(--status-positive)" />
              3. Session Encryption
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Temporary database connection secrets are encrypted using Django's cryptographically signed session store and never written to plain disk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
