import React from 'react';
import '../../styles/admin_style/RegistrationRequest.css';

const NewCompanyRegistrationModal = ({ company, onApprove, onDeny, onClose, isProcessing }) => {
  if (!company) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">New Company Registration Request</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Body Description */}
        <p className="modal-description">
          A new company has requested access to the Asset Tender Portal. Please review
          their details below to approve or deny their registration.
        </p>

        {/* Info Grid Box */}
        <div className="modal-info-box">
          <div className="modal-info-col">
            <span className="modal-info-label">Company Name</span>
            <div className="modal-info-value">
              <span className="info-icon">🏢</span>
              <strong>{company.name}</strong>
            </div>
          </div>
          <div className="modal-info-col">
            <span className="modal-info-label">Contact Email</span>
            <div className="modal-info-value">
              <span className="info-icon">✉️</span>
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </div>
          </div>
        </div>

        {/* Document / Banner Image Area */}
        <div className="modal-banner-container">
          <img
            src={company.image || "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600"}
            alt="Verification document"
            className="modal-banner-img"
          />
          <div className="modal-banner-badge">VERIFICATION PENDING</div>
        </div>

        {/* Footer Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-deny"
            onClick={onDeny}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Deny"}
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-approve"
            onClick={onApprove}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "✓ Approve"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCompanyRegistrationModal;