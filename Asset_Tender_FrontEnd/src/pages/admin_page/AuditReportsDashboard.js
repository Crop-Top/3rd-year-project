import React, { useState } from 'react';
import AdminLayout from './AdminLayout';
import '../../styles/admin_style/AuditReportsDashboard.css';

const REPORT_TYPES = [
  { key: 'disposal-summary', icon: '↺', title: 'Asset Disposal Summary', description: 'Overview of assets decommissioned and sold.' },
  { key: 'financial-audit', icon: '🏛', title: 'Financial Audit', description: 'Valuation changes and depreciation metrics.' },
  { key: 'user-activity', icon: '👤', title: 'User Activity Log', description: 'System access and modification tracking.' },
];

const RECENT_REPORTS = [
  { id: 1, name: 'Q3 Asset Disposal Summary', requestedBy: 'Requested by: System Admin', date: 'Oct 24, 2023 • 14:30', format: 'PDF' },
  { id: 2, name: 'FY23 Preliminary Financial Audit', requestedBy: 'Requested by: System Admin', date: 'Oct 20, 2023 • 09:15', format: 'CSV' },
  { id: 3, name: 'Weekly User Activity Log', requestedBy: 'Automated Generation', date: 'Oct 16, 2023 • 00:00', format: 'PDF' },
];

const AuditReportsDashboard = () => {
  const [selectedType, setSelectedType] = useState('disposal-summary');
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  return (
    <AdminLayout pageLabel="Audit Reports Dashboard">
      <h1 className="ard-title">Audit Reports</h1>
      <p className="ard-subtitle">
        Generate comprehensive summaries of institutional assets, financial audits, and platform activity.
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
            <div className="ard-date-field">
              <label className="ard-field-label" htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                className="ard-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="yyyy/mm/dd"
              />
            </div>
            <div className="ard-date-field">
              <label className="ard-field-label" htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                type="date"
                className="ard-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="yyyy/mm/dd"
              />
            </div>
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

          <button type="button" className="ard-generate-btn">⭳ Generate Report</button>
        </div>
      </div>

      <div className="ard-recent-card">
        <div className="ard-recent-header">
          <span className="ard-card-heading">↺ Recent Reports</span>
          <a href="#view-all-archive" className="ard-view-all-link">View All Archive</a>
        </div>

        <div className="ard-table-head">
          <span>DOCUMENT NAME</span>
          <span>GENERATED DATE</span>
          <span>FORMAT</span>
          <span className="ard-table-head-action">ACTIONS</span>
        </div>

        {RECENT_REPORTS.map((report) => (
          <div className="ard-table-row" key={report.id}>
            <span className="ard-doc-cell">
              <span className="ard-doc-icon">🗎</span>
              <span className="ard-doc-info">
                <span className="ard-doc-name">{report.name}</span>
                <span className="ard-doc-requested">{report.requestedBy}</span>
              </span>
            </span>
            <span className="ard-doc-date">{report.date}</span>
            <span className="ard-format-badge">{report.format}</span>
            <button type="button" className="ard-row-action">⋯</button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AuditReportsDashboard;