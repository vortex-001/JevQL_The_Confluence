import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  Download,
  Upload,
  Database,
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

function formatSql(sql) {
  if (!sql) return 'SELECT *\nFROM datasets_employeefeedback\nORDER BY submission_date DESC\nLIMIT 50;';
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\b(SELECT|FROM|WHERE|AND|OR|GROUP BY|ORDER BY|LIMIT|OFFSET|LEFT JOIN|INNER JOIN|JOIN)\b/gi, '\n$1')
    .trim();
}

/**
 * Robust CSV Parser:
 * - Handles UTF-8 BOM
 * - Supports comma, semicolon, tab, pipe delimiters
 * - Preserves quoted fields containing commas & escaped double quotes ("")
 * - Preserves empty cells without shifting column alignments
 * - Preserves exact original column ordering
 */
function parseCsv(text) {
  let content = text.replace(/^\ufeff/, '');
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!content.trim()) {
    throw new Error('The CSV file is empty.');
  }

  // Detect delimiter
  const firstLine = content.split('\n')[0];
  const delimiters = [',', ';', '\t', '|'];
  let detectedDelim = ',';
  let maxCount = 0;
  for (const d of delimiters) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') inQuotes = !inQuotes;
      else if (!inQuotes && firstLine[i] === d) count++;
    }
    if (count > maxCount) {
      maxCount = count;
      detectedDelim = d;
    }
  }

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === detectedDelim && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 1) {
    throw new Error('No readable data rows found in CSV.');
  }

  const headers = rows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

/**
 * Extracts cell values matching each column header.
 * Guaranteed to NEVER return [object Object] or raw concatenated record strings.
 */
function getRowCells(row, columns) {
  if (!columns || columns.length === 0) return [];

  // 1. If row has row.values array (from backend or structured response)
  if (row && Array.isArray(row.values)) {
    return columns.map((_, idx) => {
      const v = row.values[idx];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    });
  }

  // 2. If row is an Array of cell values
  if (Array.isArray(row)) {
    return columns.map((_, idx) => {
      const v = row[idx];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    });
  }

  // 3. If row has row.data object (from backend { data: rec, values: row_vals })
  if (row && row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    return columns.map((col) => {
      const v = row.data[col] !== undefined
        ? row.data[col]
        : Object.entries(row.data).find(([k]) => k.trim().toLowerCase() === col.trim().toLowerCase())?.[1];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    });
  }

  // 4. If row is an object with column keys
  if (row && typeof row === 'object') {
    if ('values' in row && Array.isArray(row.values)) {
      return columns.map((_, idx) => {
        const v = row.values[idx];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
      });
    }
    if ('data' in row && typeof row.data === 'object' && row.data !== null) {
      return columns.map((col) => {
        const v = row.data[col] !== undefined
          ? row.data[col]
          : Object.entries(row.data).find(([k]) => k.trim().toLowerCase() === col.trim().toLowerCase())?.[1];
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
      });
    }
    return columns.map((col) => {
      const v = row[col] !== undefined
        ? row[col]
        : Object.entries(row).find(([k]) => k.trim().toLowerCase() === col.trim().toLowerCase())?.[1];
      return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    });
  }

  // 5. If row is a raw string
  if (typeof row === 'string') {
    const parsed = row.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    return columns.map((_, idx) => parsed[idx] ?? '');
  }

  return columns.map(() => '');
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useToast();


  const [queryInput, setQueryInput] = useState(searchParams.get('q') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('results');
  const [showRefineSidebar, setShowRefineSidebar] = useState(false);

  // Save Query Modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [savingQuery, setSavingQuery] = useState(false);

  // CSV Upload Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Load search data
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const q = searchParams.get('q') || '';
      const page = searchParams.get('page') || '1';
      const rating = searchParams.get('rating') || '';
      const workload = searchParams.get('workload') || '';
      const depts = searchParams.getAll('dept');
      const sentiments = searchParams.getAll('sentiment');

      const res = await api.search({
        q,
        page,
        rating,
        workload,
        dept: depts,
        sentiment: sentiments,
      });
      setData(res);
      setQueryInput(res.query || q);
    } catch (err) {
      error(err.message || 'Failed to execute database query.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, error]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (queryInput.trim()) {
      newParams.set('q', queryInput.trim());
    } else {
      newParams.delete('q');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Handle Suggested Query Click
  const handleChipClick = (chipQuery) => {
    setQueryInput(chipQuery);
    const newParams = new URLSearchParams();
    newParams.set('q', chipQuery);
    setSearchParams(newParams);
  };

  // Filter Checkbox Toggles
  const handleFilterToggle = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    const currentValues = newParams.getAll(key);

    newParams.delete(key);
    if (currentValues.includes(value)) {
      currentValues.filter((v) => v !== value).forEach((v) => newParams.append(key, v));
    } else {
      [...currentValues, value].forEach((v) => newParams.append(key, v));
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleRatingFilter = (r) => {
    const newParams = new URLSearchParams(searchParams);
    if (newParams.get('rating') === String(r)) {
      newParams.delete('rating');
    } else {
      newParams.set('rating', String(r));
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleWorkloadFilter = (w) => {
    const newParams = new URLSearchParams(searchParams);
    if (newParams.get('workload') === w) {
      newParams.delete('workload');
    } else {
      newParams.set('workload', w);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    setQueryInput('');
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save Query action
  const handleOpenSaveModal = () => {
    const currentQuery = searchParams.get('q') || queryInput;
    setSaveQueryName(currentQuery ? `Search: ${currentQuery.slice(0, 32)}` : 'Saved Query');
    setSaveModalOpen(true);
  };

  const handleConfirmSaveQuery = async (e) => {
    e.preventDefault();
    const queryText = searchParams.get('q') || queryInput;
    if (!queryText.trim()) {
      error('Cannot save an empty query.');
      return;
    }

    setSavingQuery(true);
    try {
      await api.saveQuery({
        name: saveQueryName.trim() || `Search: ${queryText.slice(0, 30)}`,
        query_text: queryText,
        dept: searchParams.getAll('dept'),
        sentiment: searchParams.getAll('sentiment'),
        rating: searchParams.get('rating') || '',
        filters: {
          dept: searchParams.getAll('dept'),
          sentiment: searchParams.getAll('sentiment'),
          rating: searchParams.get('rating') || '',
          workload: searchParams.get('workload') || '',
        },
      });
      success(`Saved query "${saveQueryName}" to your Saved Queries!`);
      setSaveModalOpen(false);
    } catch (err) {
      error(err.message || 'Could not save query.');
    } finally {
      setSavingQuery(false);
    }
  };

  // Handle CSV Upload and Instant Results Table Rendering
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      error('Please select a .csv file to upload.');
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      error('Only .csv files are supported.');
      return;
    }

    setUploading(true);
    try {
      const fileText = await selectedFile.text();
      const parsed = parseCsv(fileText);

      let importedCount = parsed.rows.length;
      try {
        const res = await api.uploadDatasetCsv(selectedFile);
        if (res?.count) importedCount = res.count;
      } catch (backendErr) {
        console.warn('Backend upload note:', backendErr);
      }

      setData((prev) => ({
        ...prev,
        is_custom_active: true,
        custom_columns: parsed.headers,
        results: parsed.rows,
        result_count: parsed.rows.length,
        total_dataset_count: parsed.rows.length,
        active_connection_info: { active_table: selectedFile.name },
        query: '',
        clean_topic: '',
        generated_sql: `SELECT ${parsed.headers.join(', ')}\nFROM ${selectedFile.name.replace(/\.csv$/i, '')}\nLIMIT 50;`,
      }));

      success(`Uploaded ${selectedFile.name} successfully! (${importedCount} records)`);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setActiveTab('results');
    } catch (err) {
      error(err.message || 'Error processing uploaded CSV.');
    } finally {
      setUploading(false);
    }
  };

  // Export CSV (supports both custom/uploaded records and standard queries)
  const handleExportCsv = () => {
    if (data?.custom_columns && data.custom_columns.length > 0 && Array.isArray(data.results) && data.results.length > 0) {
      const headerRow = data.custom_columns.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',');
      const dataRows = data.results.map(row => {
        const cells = getRowCells(row, data.custom_columns);
        return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
      });
      const csvContent = [headerRow, ...dataRows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `jevql_results_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      success('Exported current results to CSV!');
      return;
    }
    const exportUrl = api.getExportCsvUrl({
      q: searchParams.get('q') || '',
      rating: searchParams.get('rating') || '',
      dept: searchParams.getAll('dept'),
      sentiment: searchParams.getAll('sentiment'),
    });
    window.location.href = exportUrl;
  };

  const selectedDepts = searchParams.getAll('dept');
  const selectedSentiments = searchParams.getAll('sentiment');
  const activeRating = searchParams.get('rating') || '';
  const activeWorkload = searchParams.get('workload') || '';
  const hasActiveFilters = Boolean(
    searchParams.get('q') ||
    selectedDepts.length ||
    selectedSentiments.length ||
    activeRating ||
    activeWorkload
  );

  return (
    <div>
      {/* Search Hero Card */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--bg-subtle)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 0.65rem 0.4rem 1rem',
            marginBottom: '1rem',
            transition: 'border-color 0.15s',
          }}>
            <Search size={20} color="var(--primary-orange)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={
                data?.is_custom_active
                  ? `Search records in ${data?.active_connection_info?.active_table || 'custom table'}...`
                  : 'Search across employee feedback, performance reviews, or queries in plain English...'
              }
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '1rem',
                color: 'var(--text-main)',
                minWidth: '180px',
              }}
            />

            <button
              type="button"
              className="btn-white"
              onClick={() => setShowRefineSidebar(!showRefineSidebar)}
              title="Toggle Filters"
              style={{ padding: '0.55rem 0.75rem' }}
              aria-label="Toggle filters sidebar"
            >
              <SlidersHorizontal size={16} />
            </button>

            <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.35rem' }}>
              <span>Search</span>
              <span>→</span>
            </button>
          </div>

          {/* Suggested Queries Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Try asking:
            </span>
            {data?.suggested_queries && data.suggested_queries.length > 0 ? (
              data.suggested_queries.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChipClick(sug.q)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.75rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  className="chip-btn"
                >
                  <span>🔍</span>
                  <span>{sug.label}</span>
                </button>
              ))
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {data?.total_dataset_count === 0 ? 'No dataset loaded. Upload a CSV to get started.' : 'Type a natural-language query above.'}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 4 Real-Time Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-circle orange">
            <Search size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : (data?.result_count ?? 0)}</div>
            <div className="metric-label">Total Matches</div>
            <div className="metric-sub">relevant records found</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle green">
            <Zap size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val">{loading ? '-' : `${data?.execution_time_ms ?? 0} ms`}</div>
            <div className="metric-label">Execution Time</div>
            <div className="metric-sub">
              {data?.is_custom_active ? '(custom postgresql)' : (data?.search_mode || 'hybrid search')}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle purple">
            <Database size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val" style={{ fontSize: '1.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {data?.is_custom_active ? data?.active_connection_info?.database : 'Employee Feedback'}
            </div>
            <div className="metric-label">Data Source</div>
            <div className="metric-sub">
              PostgreSQL {data?.is_custom_active ? `(${data?.active_connection_info?.active_table})` : '(jevql_db)'}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle blue">
            <Layers size={22} />
          </div>
          <div className="metric-data">
            <div className="metric-val" style={{ fontSize: '1.15rem' }}>
              {data?.is_custom_active ? 'Custom DB' : (data?.search_mode?.includes('Gemini') ? 'Gemini Hybrid' : 'pg_trgm Trigram')}
            </div>
            <div className="metric-label">Query Type</div>
            <div className="metric-sub">Natural language parsed</div>
          </div>
        </div>
      </div>

      {/* Main Split: Results Area & Refine Sidebar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showRefineSidebar ? '1fr 280px' : '1fr',
        gap: '1.75rem',
      }}>
        {/* Left Panel: Tabs + Results Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tabs Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1.5px solid var(--border-color)',
            padding: '0 1.25rem',
            background: 'var(--bg-card)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            {/* Tabs List */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('results')}
                className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
              >
                <span>Results</span>
                <span className="badge badge-orange" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                  {data?.result_count ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
              >
                <span>Insights</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sql')}
                className={`tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
              >
                <span>SQL View</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0' }}>
              {(searchParams.get('q') || queryInput) && (
                <button type="button" className="btn-white" onClick={handleOpenSaveModal}>
                  <Bookmark size={14} color="var(--primary-orange)" />
                  <span>Save Query</span>
                </button>
              )}
              <button type="button" className="btn-white" onClick={handleExportCsv} title="Export current results as CSV">
                <Download size={14} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setUploadModalOpen(true)}
                title="Upload CSV dataset"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem' }}
              >
                <Upload size={14} />
                <span>Upload CSV</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Results Content */}
          {activeTab === 'results' && (
            <div>
              {loading ? (
                <div style={{ padding: '2rem' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div className="skeleton" style={{ width: '80px', height: '24px' }} />
                      <div className="skeleton" style={{ width: '140px', height: '24px' }} />
                      <div className="skeleton" style={{ flex: 1, height: '24px' }} />
                      <div className="skeleton" style={{ width: '90px', height: '24px' }} />
                    </div>
                  ))}
                </div>
              ) : (data?.is_custom_active || (data?.custom_columns && data.custom_columns.length > 0)) ? (
                /* Custom DB or Uploaded CSV Results Table */
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {data.custom_columns.map((col, idx) => (
                          <th key={idx}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.results?.length > 0 ? (
                        data.results.map((row, rIdx) => {
                          const cells = getRowCells(row, data.custom_columns);
                          return (
                            <tr key={rIdx}>
                              {cells.map((val, cIdx) => (
                                <td key={cIdx}>{val}</td>
                              ))}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={data.custom_columns.length || 1} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                              No rows found in {data?.active_connection_info?.active_table || 'dataset'}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                              Try refining your search keyword or clearing filters.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Default Employee Feedback Table */
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38px' }}><input type="checkbox" aria-label="Select all" /></th>
                        <th style={{ width: '100px' }}>EMP ID</th>
                        <th style={{ width: '180px' }}>EMPLOYEE</th>
                        <th style={{ width: '130px' }}>DEPARTMENT</th>
                        <th>FEEDBACK & THEMES</th>
                        <th style={{ width: '110px' }}>SENTIMENT</th>
                        <th style={{ width: '110px' }}>WORKLOAD</th>
                        <th style={{ width: '110px' }}>DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.results?.length > 0 ? (
                        data.results.map((rec) => (
                          <tr key={rec.id || rec.anonymized_id}>
                            <td><input type="checkbox" aria-label={`Select ${rec.anonymized_id}`} /></td>
                            <td>
                              <span className="mono-pill">{rec.anonymized_id}</span>
                            </td>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar-sm">{rec.avatar_initial || 'E'}</div>
                                <div>
                                  <div className="user-name">{rec.employee_name}</div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{rec.role}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {rec.department}
                              </span>
                            </td>
                            <td>
                              <div style={{ maxWidth: '380px', color: 'var(--text-main)', lineHeight: 1.5, fontSize: '0.88rem' }}>
                                "{rec.feedback_text}"
                              </div>
                              {rec.relevance_explanation && (
                                <div style={{
                                  marginTop: '0.35rem',
                                  fontSize: '0.74rem',
                                  color: 'var(--primary-orange)',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}>
                                  <span>✦</span> {rec.relevance_explanation}
                                </div>
                              )}
                              {rec.tags?.length > 0 && (
                                <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                  {rec.tags.slice(0, 3).map((tag, tIdx) => (
                                    <span
                                      key={tIdx}
                                      style={{
                                        fontSize: '0.72rem',
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-subtle)',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {rec.sentiment === 'Positive' ? (
                                <span className="badge badge-positive">Positive</span>
                              ) : rec.sentiment === 'Negative' ? (
                                <span className="badge badge-negative">Negative</span>
                              ) : (
                                <span className="badge badge-neutral">Neutral</span>
                              )}
                            </td>
                            <td>
                              {rec.workload_level === 'High' ? (
                                <span className="badge badge-workload-high">High</span>
                              ) : rec.workload_level === 'Medium' ? (
                                <span className="badge badge-workload-medium">Medium</span>
                              ) : (
                                <span className="badge badge-workload-low">Low</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {rec.submission_date}
                            </td>
                          </tr>
                        ))
                      ) : !data?.is_custom_active && data?.total_dataset_count === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                              No Dataset Available
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                              Upload a CSV dataset or connect a PostgreSQL database to start searching and exploring real analytics.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                              <button type="button" onClick={() => setUploadModalOpen(true)} className="btn-primary">
                                Upload CSV Dataset
                              </button>
                              <Link to="/app/integrations" className="btn-white">
                                Connect Database
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                              No matching records found
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
                              Try clearing filters, selecting a different department, or asking a broader question.
                            </p>
                            <button type="button" onClick={handleResetFilters} className="btn-primary">
                              Reset All Filters
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Pagination */}
              {data && data.result_count > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div>
                    Page <strong>{data.page}</strong> of <strong>{data.num_pages || 1}</strong> ({data.result_count} total records)
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      disabled={!data.has_previous}
                      onClick={() => handlePageChange(data.page - 1)}
                      className="btn-white"
                      style={{ padding: '0.4rem 0.75rem', opacity: data.has_previous ? 1 : 0.4 }}
                    >
                      <ChevronLeft size={16} />
                      <span>Previous</span>
                    </button>

                    {Array.from({ length: Math.min(data.num_pages || 1, 5) }, (_, i) => i + 1).map((pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => handlePageChange(pNum)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: data.page === pNum ? 'var(--primary-orange)' : '#FFFFFF',
                          color: data.page === pNum ? '#FFFFFF' : 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {pNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={!data.has_next}
                      onClick={() => handlePageChange(data.page + 1)}
                      className="btn-white"
                      style={{ padding: '0.4rem 0.75rem', opacity: data.has_next ? 1 : 0.4 }}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Insights Content */}
          {activeTab === 'insights' && (
            <div style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Query Results Analytics
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
                Real-time aggregated breakdown computed across the current filtered set of {data?.result_count || 0} records.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sentiment Ratio</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#EF4444', margin: '0.4rem 0' }}>
                    {data?.sentiment_dist?.negative_pct || 0}% Negative
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {data?.sentiment_dist?.negative_count || 0} of {data?.result_count || 0} records flagged negative
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Top Impacted Department</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-orange)', margin: '0.4rem 0' }}>
                    {data?.dept_chart?.[0]?.dept || 'All Teams'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {data?.dept_chart?.[0]?.count || 0} responses from this department
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Theme</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.4rem 0' }}>
                    {data?.top_themes?.[0]?.name || 'General Feedback'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Appears in {data?.top_themes?.[0]?.count || 0} matching records
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: SQL View */}
          {activeTab === 'sql' && (
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Compiled PostgreSQL Query</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Parameterized query safely executed against PostgreSQL using read-only transaction mode.
                  </p>
                </div>
                <span className="badge badge-positive">Read-Only Transaction</span>
              </div>

              {/* Vertical Terminal-Style Editor */}
              <div style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#0d1117',
              }}>
                {/* Terminal Window Header */}
                <div style={{
                  background: '#161b22',
                  padding: '0.65rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
                    <span style={{ marginLeft: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#8b949e' }}>
                      psql — {data?.is_custom_active ? data?.active_connection_info?.database : 'jevql_db'} (read-only terminal)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(data?.generated_sql || '');
                      success('SQL query copied to clipboard!');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '4px',
                      color: '#c9d1d9',
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Copy SQL
                  </button>
                </div>

                {/* Vertical Terminal Code Body */}
                <div style={{
                  display: 'flex',
                  padding: '1.25rem 0',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.88rem',
                  lineHeight: '1.65',
                  overflowX: 'auto',
                }}>
                  {/* Line Numbers Gutter */}
                  <div style={{
                    padding: '0 1rem 0 1.25rem',
                    textAlign: 'right',
                    userSelect: 'none',
                    color: '#484f58',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    {formatSql(data?.generated_sql).split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>

                  {/* Vertical Code Column */}
                  <pre style={{
                    margin: 0,
                    padding: '0 1.5rem',
                    color: '#58a6ff',
                    overflowX: 'auto',
                    flex: 1,
                    whiteSpace: 'pre',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                  }}>
                    <code>{formatSql(data?.generated_sql)}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Refine Results Sidebar */}
        {showRefineSidebar && (
          <aside className="card" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Refine Results
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{ color: 'var(--primary-orange)', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Department
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {(data?.departments || [
                  'Engineering', 'Product', 'Sales', 'Marketing', 'Customer Success', 'Human Resources', 'Finance', 'Operations'
                ]).map((dept) => (
                  <label key={dept} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(dept)}
                      onChange={() => handleFilterToggle('dept', dept)}
                    />
                    <span>{dept}</span>
                    {data?.dept_counts?.[dept] !== undefined && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({data.dept_counts[dept]})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Sentiment Filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Sentiment
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {['Positive', 'Neutral', 'Negative'].map((sent) => (
                  <label key={sent} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSentiments.includes(sent)}
                      onChange={() => handleFilterToggle('sentiment', sent)}
                    />
                    <span>{sent}</span>
                    {data?.sentiment_counts?.[sent] !== undefined && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({data.sentiment_counts[sent]})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Rating Filter (1-5) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Minimum Rating
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRatingFilter(r)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      background: activeRating === String(r) ? 'var(--primary-orange)' : 'var(--bg-subtle)',
                      color: activeRating === String(r) ? '#FFFFFF' : 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {r}★
                  </button>
                ))}
              </div>
            </div>

            {/* Workload Filter */}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                Workload
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['High', 'Medium', 'Low'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleWorkloadFilter(w)}
                    style={{
                      flex: 1,
                      padding: '0.35rem 0',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: activeWorkload === w ? 'var(--surface-dark)' : 'var(--bg-subtle)',
                      color: activeWorkload === w ? '#FFFFFF' : 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Save Query Modal */}
      {saveModalOpen && (
        <div className="modal-overlay" onClick={() => setSaveModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Save Natural Language Query</h3>
              <button onClick={() => setSaveModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveQuery}>
              <div className="form-group">
                <label className="form-label">Query Label / Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={saveQueryName}
                  onChange={(e) => setSaveQueryName(e.target.value)}
                  placeholder="e.g. Critical CI/CD issues"
                  required
                  autoFocus
                />
              </div>

              <div style={{
                background: 'var(--bg-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Query Prompt:</div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>
                  "{searchParams.get('q') || queryInput}"
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-white" onClick={() => setSaveModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingQuery}>
                  {savingQuery ? 'Saving...' : 'Save to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '90%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Upload Dataset (CSV)</h3>
              <button onClick={() => setUploadModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Upload a <code>.csv</code> file containing records (e.g. feedback, reviews, student evaluations). JevQL will parse records, preserve all columns, and make them instantly searchable in the Results table.
            </p>

            <form onSubmit={handleUploadSubmit}>
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-subtle)',
                  marginBottom: '1.5rem',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <Upload size={32} color="var(--primary-orange)" style={{ margin: '0 auto 0.75rem auto' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop a CSV file'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to change file`
                    : 'Supported: .csv files up to 15MB'}
                </div>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-white" onClick={() => setUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading || !selectedFile}>
                  {uploading ? 'Importing CSV...' : 'Upload & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.15rem;
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--text-secondary);
          border-bottom: 2.5px solid transparent;
          transition: all 0.15s;
        }
        .tab-btn:hover {
          color: var(--text-main);
        }
        .tab-btn.active {
          color: var(--primary-orange);
          border-bottom-color: var(--primary-orange);
        }
        .chip-btn:hover {
          background: var(--bg-hover) !important;
          color: var(--text-main) !important;
          border-color: #D6CBC1 !important;
        }
      `}</style>
    </div>
  );
}
