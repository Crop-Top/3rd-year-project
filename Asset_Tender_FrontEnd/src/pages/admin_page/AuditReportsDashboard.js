import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/admin_style/AuditReportsDashboard.css';
import Portalheader from '../../components/Portalheader';
import Portalfooter from '../../components/Portalfooter';
import ReportDatePicker from '../../components/ReportDatePicker';
import {
  REPORT_TYPES,
  downloadReportCsv,
  getReportTypeMeta,
} from '../../services/reportService';

const SESSION_RECENT_KEY = 'auditReportsRecent';

function loadSessionRecent() {
  try {
    const raw = sessionStorage.getItem(SESSION_RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionRecent(entries) {
  sessionStorage.setItem(SESSION_RECENT_KEY, JSON.stringify(entries.slice(0, 10)));
}

const AuditReportsDashboard = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('disposal-outcomes');
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentReports, setRecentReports] = useState(loadSessionRecent);

  const selectedMeta = getReportTypeMeta(selectedType);
  const requiresDateRange = selectedMeta?.requiresDateRange ?? true;
  const today = useMemo(() => new Date(), []);
  const startMaxDate = useMemo(() => {
    if (!endDate) {
      return today;
    }

    const parsedEnd = new Date(`${endDate}T00:00:00`);
    return parsedEnd < today ? parsedEnd : today;
  }, [endDate, today]);
  const endMinDate = useMemo(() => {
    if (!startDate) {
      return new Date(2020, 0, 1);
    }

    return new Date(`${startDate}T00:00:00`);
  }, [startDate]);

  const recordRecent = (format) => {
    const entry = {
      id: `${Date.now()}-${selectedType}`,
      name: selectedMeta?.title || selectedType,
      type: selectedType,
      startDate: startDate || null,
      endDate: endDate || null,
      format: format.toUpperCase(),
      generatedAt: new Date().toISOString(),
    };
    const next = [entry, ...recentReports.filter((r) => r.id !== entry.id)].slice(0, 10);
    setRecentReports(next);
    saveSessionRecent(next);
  };

  const handleGenerate = async () => {
    setError('');

    if (requiresDateRange && (!startDate || !endDate)) {
      setError('Start date and end date are required for this report.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError('Start date must be on or before end date.');
      return;
    }

    setLoading(true);

    try {
      if (outputFormat === 'csv') {
        await downloadReportCsv(selectedType, startDate || undefined, endDate || undefined);
        recordRecent('csv');
      } else {
        const params = new URLSearchParams({ type: selectedType });
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        navigate(`/audit-report-preview?${params.toString()}`);
        recordRecent('pdf');
      }
    } catch (err) {
      setError(err.message || 'Unable to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const openRecentPreview = (report) => {
    const params = new URLSearchParams({ type: report.type });
    if (report.startDate) params.set('startDate', report.startDate);
    if (report.endDate) params.set('endDate', report.endDate);
    navigate(`/audit-report-preview?${params.toString()}`);
  };

  const formatGeneratedAt = (iso) => {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="ard-page">
      <Portalheader />

      <div className="ard-content">
        <h1 className="ard-title">Audit Reports</h1>
        <p className="ard-subtitle">
          Generate institutional summaries of asset disposals, tenders, offers, and user registrations.
        </p>

        <div className="ard-top-row">
          <div className="ard-config-card">
            <span className="ard-card-heading">Report Configuration</span>

            <span className="ard-field-label">Select Report Type</span>
            <div className="ard-type-grid">
              {REPORT_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.key}
                  className={`ard-type-card ${selectedType === type.key ? 'ard-type-card-selected' : ''}`}
                  onClick={() => setSelectedType(type.key)}
                >
                  <div className="ard-type-top">
                    <span className="ard-type-icon">{type.icon}</span>
                    {selectedType === type.key && <span className="ard-type-check">✓</span>}
                  </div>
                  <span className="ard-type-title">{type.title}</span>
                  <span className="ard-type-desc">{type.description}</span>
                </button>
              ))}
            </div>

            <div className="ard-date-row">
              <ReportDatePicker
                id="start-date"
                label="Start Date"
                optionalLabelSuffix={requiresDateRange ? '' : ' (optional)'}
                value={startDate}
                onChange={setStartDate}
                maxDate={startMaxDate}
              />
              <ReportDatePicker
                id="end-date"
                label="End Date"
                optionalLabelSuffix={requiresDateRange ? '' : ' (optional)'}
                value={endDate}
                onChange={setEndDate}
                minDate={endMinDate}
                maxDate={today}
              />
            </div>
          </div>

          <div className="ard-output-card">
            <span className="ard-output-heading">🖵 Output Settings</span>
            <p className="ard-output-desc">Select the preferred format for your exported data.</p>

            <div className="ard-format-toggle">
              <button
                type="button"
                className={`ard-format-btn ${outputFormat === 'pdf' ? 'ard-format-btn-active' : ''}`}
                onClick={() => setOutputFormat('pdf')}
              >
                PDF Document
              </button>
              <button
                type="button"
                className={`ard-format-btn ${outputFormat === 'csv' ? 'ard-format-btn-active' : ''}`}
                onClick={() => setOutputFormat('csv')}
              >
                Raw CSV
              </button>
            </div>

            {error && <p className="ard-error" role="alert">{error}</p>}

            <button
              type="button"
              className="ard-generate-btn"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating…' : '⭳ Generate Report'}
            </button>
          </div>
        </div>

        <div className="ard-recent-card">
          <div className="ard-recent-header">
            <span className="ard-card-heading">↺ Recent Reports (this session)</span>
          </div>

          {recentReports.length === 0 ? (
            <p className="ard-recent-empty">No reports generated yet in this session.</p>
          ) : (
            <>
              <div className="ard-table-head">
                <span>DOCUMENT NAME</span>
                <span>GENERATED DATE</span>
                <span>FORMAT</span>
                <span className="ard-table-head-action">ACTIONS</span>
              </div>

              {recentReports.map((report) => (
                <div className="ard-table-row" key={report.id}>
                  <span className="ard-doc-cell">
                    <span className="ard-doc-icon">🗎</span>
                    <span className="ard-doc-info">
                      <span className="ard-doc-name">{report.name}</span>
                      <span className="ard-doc-requested">
                        {report.startDate && report.endDate
                          ? `${report.startDate} → ${report.endDate}`
                          : 'No date filter'}
                      </span>
                    </span>
                  </span>
                  <span className="ard-doc-date">{formatGeneratedAt(report.generatedAt)}</span>
                  <span className="ard-format-badge">{report.format}</span>
                  <button
                    type="button"
                    className="ard-row-action"
                    onClick={() => openRecentPreview(report)}
                    title="Open preview"
                  >
                    View
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <Portalfooter />
    </div>
  );
};

export default AuditReportsDashboard;
