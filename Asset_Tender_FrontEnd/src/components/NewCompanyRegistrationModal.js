import React from 'react';
import "../styles/component_style/NewCompanyRegistrationModal.css";

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 14V2.5C3 2.22 3.22 2 3.5 2H9.5C9.78 2 10 2.22 10 2.5V14"
      stroke="#F0A93D" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M10 6.5H12.5C12.78 6.5 13 6.72 13 7V14" stroke="#F0A93D" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M5 4.5H8M5 7H8M5 9.5H8" stroke="#F0A93D" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="3" width="13" height="10" rx="1.2" stroke="#3B82F6" strokeWidth="1.3" />
    <path d="M2 4L8 8.5L14 4" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.5 4.5L6.5 11.5L2.5 7.5" stroke="#1B2A4A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * NewCompanyRegistrationModal
 *
 * Props:
 *  - company: { name, email, image }
 *  - onApprove: () => void
 *  - onDeny: () => void
 *  - onClose: () => void
 *  - isOpen: boolean
 */
const NewCompanyRegistrationModal = ({ company, onApprove, onDeny, onClose, isOpen = true }) => {
  if (!isOpen) return null;

  return (
    <div className="reg-modal-overlay" onClick={onClose}>
      <div className="reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reg-modal-header">
          <h2 className="reg-modal-title">New Company Registration Request</h2>
          <button className="reg-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="reg-modal-description">
          A new company has requested access to the Asset Tender Portal. Please review
          their details below to approve or deny their registration.
        </p>

        <div className="reg-modal-details">
          <div className="reg-modal-detail-col">
            <span className="reg-modal-label">Company Name</span>
            <div className="reg-modal-value">
              <BuildingIcon />
              <span className="reg-modal-value-strong">{company.name}</span>
            </div>
          </div>

          <div className="reg-modal-detail-col">
            <span className="reg-modal-label">Contact Email</span>
            <div className="reg-modal-value">
              <MailIcon />
              <span className="reg-modal-value-link">{company.email}</span>
            </div>
          </div>
        </div>

        <div className="reg-modal-image-wrapper">
          <img src={company.image} alt={company.name} className="reg-modal-image" />
          <span className="reg-modal-image-badge">VERIFICATION PENDING</span>
        </div>

        <div className="reg-modal-footer">
          <button type="button" className="reg-modal-btn reg-modal-btn-deny" onClick={onDeny}>
            Deny
          </button>
          <button type="button" className="reg-modal-btn reg-modal-btn-approve" onClick={onApprove}>
            <CheckIcon />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCompanyRegistrationModal;