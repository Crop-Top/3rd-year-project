import { useEffect, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

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

  const handleReject = async (id, e) => {
    if (e) e.stopPropagation();

    const reason = window.prompt("Enter rejection reason (optional):");
    if (reason === null) return; // User clicked cancel on prompt

    try {
      setBusyId(id);
      setError("");
      await rejectTender(id, reason); // pass reason payload to apiFetch
      setApprovals((prev) => prev.filter((item) => item.id !== id));
      if (selectedTender?.id === id) {
        setSelectedTender(null);
      }
    } catch (err) {
      setError(err.message || "Reject failed.");
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

  const handleRejectSelected = async () => {
    const selected = approvals.filter((item) => item.selected);
    for (const item of selected) {
      await handleReject(item.id);
    }
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
                    alt={selectedTender.title || selectedTender.assetName}
                    className="approval-modal-image"
                  />
                </div>
              )}

              <div className="approval-modal-grid">
                <div className="approval-modal-field">
                  <span className="field-label">Asset ID / Serial</span>
                  <span className="field-value">{selectedTender.barcode_Serial || selectedTender.id || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Category</span>
                  <span className="field-value">{selectedTender.category || selectedTender.categoryID || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Department</span>
                  <span className="field-value">{selectedTender.departmentID || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Cost Center</span>
                  <span className="field-value">{selectedTender.costCenter || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Location</span>
                  <span className="field-value">{selectedTender.location || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Recommended Price</span>
                  <span className="field-value price-value">
                    R {Number(selectedTender.leadingBid || selectedTender.recommendedPrice || 0).toLocaleString("en-ZA")}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Uploaded By</span>
                  <span className="field-value">{selectedTender.uploadedBy || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Condition ID</span>
                  <span className="field-value">{selectedTender.assetConditionID || "N/A"}</span>
                </div>
              </div>

              <div className="approval-modal-section">
                <h4>Asset Description</h4>
                <p>{selectedTender.description || selectedTender.assetDescription || "No description provided."}</p>
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

      <Portalfooter />
    </div>
  );
}

export default PendingApprovals;