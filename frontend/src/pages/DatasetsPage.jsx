import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Upload, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';


export default function DatasetsPage() {
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);

  const [metadata, setMetadata] = useState(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { success, error } = useToast();

  const loadDataset = async (page = 1) => {
    setLoading(true);
    try {
      const [recRes, metaRes] = await Promise.allSettled([
        api.getDatasetRecords(page),
        api.getDatasetMetadata(),
      ]);

      if (recRes.status === 'fulfilled' && recRes.value) {
        const res = recRes.value;
        if (res.results) {
          setRecords(res.results);
          setTotalCount(res.count ?? res.results.length);
          setHasNext(Boolean(res.next));
          setHasPrevious(Boolean(res.previous));
          setCurrentPage(page);
        } else if (Array.isArray(res)) {
          setRecords(res);
          setTotalCount(res.length);
        }
      } else if (recRes.status === 'rejected') {
        throw recRes.reason;
      }

      if (metaRes.status === 'fulfilled' && metaRes.value) {
        const metaList = Array.isArray(metaRes.value)
          ? metaRes.value
          : (metaRes.value.results || []);
        if (metaList.length > 0) {
          setMetadata(metaList[0]);
        }
      }
    } catch (err) {
      error(err.message || 'Failed to load dataset records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataset(1);
  }, []);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      error('Please select a .csv file to upload.');
      return;
    }

    if (!selectedFile.name.endsWith('.csv')) {
      error('Only .csv files are supported.');
      return;
    }

    setUploading(true);
    try {
      const res = await api.uploadDatasetCsv(selectedFile);
      const countMsg = res?.count !== undefined ? ` (Imported ${res.count} records)` : '';
      success(res?.message || `Uploaded ${selectedFile.name} successfully!${countMsg}`);
      setUploadModalOpen(false);
      setSelectedFile(null);
      await loadDataset(1);
    } catch (err) {
      error(err.message || 'Error processing uploaded CSV.');
    } finally {
      setUploading(false);
    }
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
            {metadata?.name || 'Employee Feedback Dataset'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            {metadata?.description || 'Structured repository of employee survey feedback'} • Total records: <strong>{totalCount}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="btn-primary"
        >
          <Upload size={16} />
          <span>Upload CSV Dataset</span>
        </button>
      </div>

      {/* Main Records Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>ID</th>
                <th style={{ width: '140px' }}>DEPARTMENT</th>
                <th style={{ width: '180px' }}>ROLE</th>
                <th style={{ width: '90px' }}>RATING</th>
                <th style={{ width: '110px' }}>SENTIMENT</th>
                <th>FEEDBACK COMMENTS</th>
                <th style={{ width: '120px' }}>DATE</th>
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
              ) : records.length > 0 ? (
                records.map((rec) => (
                  <tr key={rec.id || rec.anonymized_id}>
                    <td>
                      <span className="mono-pill">{rec.anonymized_id}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{rec.department}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{rec.role}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: rec.rating >= 4 ? 'var(--status-positive)' : rec.rating <= 2 ? 'var(--status-negative)' : 'var(--status-neutral)',
                      }}>
                        {rec.rating}/5
                      </span>
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
                      <div style={{ maxWidth: '420px', color: 'var(--text-main)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                        "{rec.feedback_text}"
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                      {rec.submission_date}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                    No dataset records found. Click "+ Upload CSV Dataset" or run seeding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.86rem',
          color: 'var(--text-secondary)',
        }}>
          <div>
            Page <strong>{currentPage}</strong> • Total Records: <strong>{totalCount}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!hasPrevious || currentPage <= 1}
              onClick={() => loadDataset(currentPage - 1)}
              className="btn-white"
              style={{ padding: '0.4rem 0.75rem', opacity: hasPrevious ? 1 : 0.4 }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => loadDataset(currentPage + 1)}
              className="btn-white"
              style={{ padding: '0.4rem 0.75rem', opacity: hasNext ? 1 : 0.4 }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Upload CSV Modal */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Upload Dataset (CSV)</h3>
              <button onClick={() => setUploadModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Upload a <code>.csv</code> file containing employee feedback. JevQL will parse records, evaluate sentiment, and make them instantly searchable.
            </p>

            <form onSubmit={handleUploadSubmit}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem 1rem',
                textAlign: 'center',
                background: 'var(--bg-subtle)',
                marginBottom: '1.5rem',
              }}>
                <FileText size={36} color="var(--primary-orange)" style={{ margin: '0 auto 0.75rem auto' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  {selectedFile ? selectedFile.name : 'Select or drag your CSV file here'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Supported headers: id, employee_name, department, role, rating, feedback_text, tags
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-white" onClick={() => setUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Importing CSV...' : 'Upload & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
