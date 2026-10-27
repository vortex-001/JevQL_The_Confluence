import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ArrowRight } from 'lucide-react';

export default function IntegrationsPage() {
  const [data, setData] = useState(null);


  // Form state
  const [name, setName] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('postgres');
  const [password, setPassword] = useState('');

  // Action states
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [selectingTable, setSelectingTable] = useState(null);

  const { success, error, info } = useToast();

  const loadConnections = async () => {
    try {
      const res = await api.getConnections();
      setData(res);
    } catch (err) {
      error(err.message || 'Failed to load PostgreSQL connections.');
    }
  };


  useEffect(() => {
    loadConnections();
  }, []);

  const handleTestConnection = async (e) => {
    e.preventDefault();
    if (!database.trim()) {
      error('Database name is required to test connection.');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testConnection({ host, port, database, username, password });
      setTestResult(res);
      if (res.success) {
        success(`Connection verified! Latency: ${res.latency_ms} ms (${res.version})`);
      } else {
        error(res.error || 'Connection failed.');
      }
    } catch (err) {
      const errMsg = err.message || 'Connection test failed.';
      setTestResult({ success: false, error: errMsg });
      error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!database.trim()) {
      error('Database name is required to connect.');
      return;
    }

    setConnecting(true);
    try {
      const res = await api.connectDatabase({
        name: name || 'Custom PostgreSQL DB',
        host,
        port,
        database,
        username,
        password,
      });
      if (res.success) {
        success(res.message || 'Connected successfully!');
        loadConnections();
      } else {
        error(res.error || 'Could not connect.');
      }
    } catch (err) {
      error(err.message || 'Connection failed.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectTable = async (schema, table) => {
    setSelectingTable(table);
    try {
      const res = await api.selectTargetTable(schema, table);
      success(res.message || `Selected '${schema}.${table}' for search!`);
      loadConnections();
    } catch (err) {
      error(err.message || 'Failed to set search target table.');
    } finally {
      setSelectingTable(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectDatabase();
      info('Custom connection cleared. Reverted to default demo database (jevql_db).');
      loadConnections();
    } catch (err) {
      error(err.message || 'Failed to disconnect.');
    }
  };

  const currentConn = data?.current_conn;
  const hasCustom = Boolean(data?.has_custom_conn);
  const discovered = data?.discovered_structure;
  const activeColumns = data?.active_columns || [];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          PostgreSQL Connections & Schemas
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Connect external PostgreSQL databases, introspect accessible tables, and select a target table for natural language search.
        </p>
      </div>

      {/* Grid: Active Connection + Connect Form */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.75rem',
        marginBottom: '2rem',
      }}>
        {/* Active Search Target Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Active Search Target</h3>
            {hasCustom ? (
              <span className="badge badge-positive">Custom PostgreSQL Active</span>
            ) : (
              <span className="badge badge-orange">Default Demo (jevql_db)</span>
            )}
          </div>

          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Connection Name: </span>
              <strong>{currentConn?.name || 'Default Local DB'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Database: </span>
              <code style={{ background: '#FFF', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {currentConn?.database || 'jevql_db'}
              </code>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Host & Port: </span>
              <code>{currentConn?.host || 'localhost'}:{currentConn?.port || 5432}</code>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Username: </span>
              <span>{currentConn?.username || 'postgres'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Active Target Table: </span>
              {currentConn?.active_table ? (
                <span style={{ color: 'var(--primary-orange)', fontWeight: 700 }}>
                  {currentConn.active_schema || 'public'}.{currentConn.active_table}
                </span>
              ) : (
                <span>EmployeeFeedback (Default demo table)</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/app" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <span>Go to Search Console</span>
              <ArrowRight size={16} />
            </Link>
            {hasCustom && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="btn-secondary"
                style={{ color: 'var(--status-negative)' }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Connect New Database Form */}
        <div className="card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem' }}>
            Connect Another PostgreSQL Database
          </h3>

          <form onSubmit={handleConnect}>
            <div className="form-group">
              <label className="form-label">Connection Name (Optional label)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Analytics Replica"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Host *</label>
                <input
                  type="text"
                  className="form-input"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Port *</label>
                <input
                  type="number"
                  className="form-input"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Database Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. production_db or clients_db"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Database password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Test Result Indicator */}
            {testResult && (
              <div style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                background: testResult.success ? 'var(--status-positive-bg)' : 'var(--status-negative-bg)',
                color: testResult.success ? 'var(--status-positive)' : 'var(--status-negative)',
                border: `1px solid ${testResult.success ? 'var(--status-positive-border)' : 'var(--status-negative-border)'}`,
              }}>
                {testResult.success
                  ? `✓ Verified! Round-trip latency: ${testResult.latency_ms} ms (${testResult.version})`
                  : `✕ Test failed: ${testResult.error}`}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={connecting}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {connecting ? 'Connecting...' : 'Connect & Inspect'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Discovered Tables & Schemas (When custom connection is active) */}
      {hasCustom && discovered?.success && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                Discovered Tables in '{currentConn?.database}'
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Select a table to query dynamically using JevQL natural language search.
              </p>
            </div>
            <span className="badge badge-positive">
              {discovered.tables?.length || 0} Tables Found
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
            {discovered.tables?.map((tbl) => (
              <div
                key={`${tbl.schema}.${tbl.name}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1.15rem',
                  background: currentConn?.active_table === tbl.name ? '#FFFFFF' : 'var(--bg-subtle)',
                  border: currentConn?.active_table === tbl.name ? '1.5px solid var(--primary-orange)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                    {tbl.schema}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>
                    {tbl.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                    (~{tbl.estimated_rows} rows)
                  </span>
                </div>

                <div>
                  {currentConn?.active_table === tbl.name ? (
                    <span className="badge badge-positive">Active Target</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectTable(tbl.schema, tbl.name)}
                      disabled={selectingTable === tbl.name}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
                    >
                      {selectingTable === tbl.name ? 'Selecting...' : 'Select for Search'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Inspected Columns of Active Table */}
          {activeColumns.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Columns in Active Target: <code style={{ color: 'var(--primary-orange)' }}>{currentConn?.active_schema || 'public'}.{currentConn?.active_table}</code>
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {activeColumns.map((col, cIdx) => (
                  <span
                    key={cIdx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.6rem',
                      background: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <strong>{col.name}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>: {col.data_type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
