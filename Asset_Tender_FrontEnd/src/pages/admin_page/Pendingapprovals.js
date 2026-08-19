import { useEffect, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';
import RejectModal from "../../components/RejectModal";

import {
  approveTender,
  getPendingTenders,
  rejectTender,
} from "../../services/assetService";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";

function PendingApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [selectedTender, setSelectedTender] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null);

  const loadPending = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getPendingTenders();
      setApprovals(rows.map((row) => ({ ...row, selected: false })));
    } catch (err) {
      setError(err.message || "Failed to load pending approvals.");
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const toggleSelect = (id, e) => {
    if (e) e.stopPropagation();
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleApprove = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      setBusyId(id);
      setError("");
      await approveTender(id);
      setApprovals((prev) => prev.filter((item) => item.id !== id));
      if (selectedTender?.id === id) {
        setSelectedTender(null);
      }
    } catch (err) {
      setError(err.message || "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  // Opens the modal for a single item
  const handleReject = (id, e) => {
    if (e) e.stopPropagation();
    const target = approvals.find((item) => item.id === id);
    setRejectingItem(target);
    setRejectModalOpen(true);
  };

  // Submitted from inside the modal
  const handleRejectSubmit = async (reason) => {
    if (!rejectingItem) return;

    try {
      setError("");

      // Check if rejecting an array (bulk) or single object
      if (Array.isArray(rejectingItem)) {
        const idsToReject = rejectingItem.map((item) => item.id);
        
        // Execute rejections sequentially
        for (const id of idsToReject) {
          setBusyId(id);
          await rejectTender(id, reason);
        }

        // Remove all selected items from UI state
        setApprovals((prev) => prev.filter((item) => !idsToReject.includes(item.id)));
      } else {
        // Single item rejection
        setBusyId(rejectingItem.id);
        await rejectTender(rejectingItem.id, reason);

        // Remove single item from UI state
        setApprovals((prev) => prev.filter((item) => item.id !== rejectingItem.id));

        if (selectedTender?.id === rejectingItem.id) {
          setSelectedTender(null);
        }
      }

      // Close modal and reset state
      setRejectModalOpen(false);
      setRejectingItem(null);
    } catch (err) {
      setError(err.message || "Failed to reject tender.");
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveSelected = async () => {
    const selected = approvals.filter((item) => item.selected);
    for (const item of selected) {
      await handleApprove(item.id);
    }
  };

  const handleRejectSelected = () => {
    const selected = approvals.filter((item) => item.selected);
    if (selected.length === 0) return;
    
    // Set selected items and open modal
    setRejectingItem(selected); 
    setRejectModalOpen(true);
  };

  const selectedCount = approvals.filter((item) => item.selected).length;
 

  return (
    <div className="approvals-page">
      <Portalheader />
      <div className="approvals-heading-row">
        <div>
          <h1 className="approvals-title">Pending Approvals</h1>
          <p className="approvals-subtitle">
            Review and action {approvals.length} pending asset tender listings.
          </p>
        </div>

        <div className="approvals-bulk-actions">
          <span className="approvals-selected-count">{selectedCount} Selected</span>
          <button
            className="approvals-bulk-btn approvals-bulk-approve"
            onClick={handleApproveSelected}
            disabled={selectedCount === 0 || busyId !== null}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve Selected
          </button>
          <button
            className="approvals-bulk-btn approvals-bulk-reject"
            onClick={handleRejectSelected}
            disabled={selectedCount === 0 || busyId !== null}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Reject Selected
          </button>
        </div>
      </div>

      {error && <p className="approvals-error">{error}</p>}
      {loading && <p className="approvals-loading">Loading pending tenders...</p>}

      <div className="approvals-list">
        {!loading &&
          approvals.map((item) => (
            <div
              key={item.id}
              className="approval-card approval-card-clickable"
              onClick={() => setSelectedTender(item)}
            >
              <div className="approval-image-placeholder">
                <input
                  type="checkbox"
                  className="approval-checkbox"
                  checked={item.selected}
                  onChange={(e) => toggleSelect(item.id, e)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="approval-status-badge">Pending Review</span>
                {item.image ? (
                  <img src={item.image} alt={item.title || item.assetName} className="approval-image" />
                ) : null}
              </div>

              <div className="approval-details">
                <div className="approval-details-top">
                  <h3 className="approval-title">{item.title || item.assetName}</h3>
                  <span className="approval-view-link">{item.category || item.categoryID}</span>
                </div>
                <p className="approval-description">{item.description || item.assetDescription}</p>

                <div className="approval-footer-row">
                  <div className="approval-reserve">
                    <p className="approval-reserve-label">Starting Bid</p>
                    <p className="approval-reserve-amount">
                      R {Number(item.leadingBid || item.recommendedPrice || 0).toLocaleString("en-ZA")}
                    </p>
                  </div>

                  <div className="approval-actions">
                    <button
                      className="approval-btn approval-btn-reject"
                      onClick={(e) => handleReject(item.id, e)}
                      disabled={busyId !== null}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Reject
                    </button>
                    <button
                      className="approval-btn approval-btn-approve"
                      onClick={(e) => handleApprove(item.id, e)}
                      disabled={busyId !== null}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {!loading && approvals.length === 0 && (
          <div className="approvals-empty">
            <p>No pending approvals remaining.</p>
          </div>
        )}
      </div>

      {/* Modal Popup for Tender Details */}
      {selectedTender && (
        <div className="approval-modal-overlay" onClick={() => setSelectedTender(null)}>
          <div className="approval-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="approval-modal-close" onClick={() => setSelectedTender(null)}>
              ✕
            </button>

            <div className="approval-modal-header">
              <h2>{selectedTender.title || selectedTender.assetName}</h2>
              <span className="approval-modal-badge">Pending Review</span>
            </div>

            <div className="approval-modal-body">
              {selectedTender.image && (
                <div className="approval-modal-image-wrapper">
                  <img
                    src={selectedTender.image}
                    alt={selectedTender.title}
                    className="approval-modal-image"
                  />
                </div>
              )}

              <div className="approval-modal-grid">
                <div className="approval-modal-field">
                  <span className="field-label">Serial Number / Barcode</span>
                  <span className="field-value">{selectedTender.barcode || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Category</span>
                  <span className="field-value">{selectedTender.category || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Department</span>
                  <span className="field-value">{selectedTender.department || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Cost Center</span>
                  <span className="field-value">{selectedTender.costCenter || "N/A"}</span> {/* TODO GET DATA*/}
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Location</span>
                  <span className="field-value">{selectedTender.location || "N/A"}</span> {/* TODO GET DATA*/}
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Recommended Price</span>
                  <span className="field-value price-value">
                    R {Number(selectedTender.recommendedBid || 0).toLocaleString("en-ZA")}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Uploaded By</span>
                  <span className="field-value">{selectedTender.uploadedBy || "N/A"}</span> {/* TODO GET DATA*/}
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Condition ID</span>
                  <span className="field-value">{selectedTender.conditionGrade || "N/A"}</span>
                </div>
              </div>

              <div className="approval-modal-section">
                <h4>Asset Description</h4>
                <p>{selectedTender.description || "No description provided."}</p>
              </div>

              {selectedTender.conditionNotes && (
                <div className="approval-modal-section">
                  <h4>Condition Notes</h4>
                  <p>{selectedTender.conditionNotes}</p>
                </div>
              )}
            </div>

            <div className="approval-modal-footer">
              <button
                className="approval-btn approval-btn-reject"
                onClick={(e) => handleReject(selectedTender.id, e)}
                disabled={busyId !== null}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject
              </button>
              <button
                className="approval-btn approval-btn-approve"
                onClick={(e) => handleApprove(selectedTender.id, e)}
                disabled={busyId !== null}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectingItem(null);
        }}
        onSubmit={handleRejectSubmit}
      />

      <Portalfooter />
    </div>
  );
}

export default PendingApprovals;