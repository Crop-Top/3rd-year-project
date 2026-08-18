import React, { useState } from 'react';
import "../styles/component_style/RejectModal.css";

export default function RejectModal({ isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    // Pass ONLY reason to onSubmit
    await onSubmit(reason);
    setIsSubmitting(false);
    setReason('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Reject Tender Listing</h3>
        <p className="modal-description">
          Please provide a reason for rejecting this asset tender.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            rows="4"
            required
            placeholder="Type rejection reason here..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="modal-textarea"
          />

          <div className="modal-button-group">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="btn-reject"
            >
              {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}