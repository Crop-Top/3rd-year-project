import { useEffect, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";
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

  // Helper to extract uniform ID (listingId or assetId or id)
  const getItemId = (item) => item.listingId ?? item.id ?? item.assetId;

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
        getItemId(item) === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleApprove = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      setBusyId(id);
      setError("");
      await approveTender(id);
      setApprovals((prev) => prev.filter((item) => getItemId(item) !== id));
      if (selectedTender && getItemId(selectedTender) === id) {
        setSelectedTender(null);
      }
    } catch (err) {
      setError(err.message || "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (id, e) => {
    if (e) e.stopPropagation();
    const target = approvals.find((item) => getItemId(item) === id);
    setRejectingItem(target);
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (reason) => {
    if (!rejectingItem) return;

    try {
      setError("");

      if (Array.isArray(rejectingItem)) {
        const idsToReject = rejectingItem.map((item) => getItemId(item));
        
        for (const id of idsToReject) {
          setBusyId(id);
          await rejectTender(id, reason);
        }

        setApprovals((prev) => prev.filter((item) => !idsToReject.includes(getItemId(item))));
      } else {
        const targetId = getItemId(rejectingItem);
        setBusyId(targetId);
        await rejectTender(targetId, reason);

        setApprovals((prev) => prev.filter((item) => getItemId(item) !== targetId));

        if (selectedTender && getItemId(selectedTender) === targetId) {
          setSelectedTender(null);
        }
      }

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
      await handleApprove(getItemId(item));
    }
  };

  const handleRejectSelected = () => {
    const selected = approvals.filter((item) => item.selected);
    if (selected.length === 0) return;
    
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
          approvals.map((item) => {
            const itemId = getItemId(item);
            return (
              <div
                key={itemId}
                className="approval-card approval-card-clickable"
                onClick={() => setSelectedTender(item)}
              >
                <div className="approval-image-placeholder">
                  <input
                    type="checkbox"
                    className="approval-checkbox"
                    checked={item.selected}
                    onChange={(e) => toggleSelect(itemId, e)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="approval-status-badge">
                    {item.tenderStatusName || item.assetStatusName || "Pending Review"}
                  </span>
                  {(item.imageUrl || item.image) ? (
                    <img
                      src={item.imageUrl || item.image}
                      alt={item.assetName || item.title}
                      className="approval-image"
                    />
                  ) : null}
                </div>

                <div className="approval-details">
                  <div className="approval-details-top">
                    <h3 className="approval-title">{item.assetName || item.title}</h3>
                    <span className="approval-view-link">{item.categoryName || item.category}</span>
                  </div>
                  <p className="approval-description">{item.description || item.assetDescription}</p>

                  <div className="approval-footer-row">
                    <div className="approval-reserve">
                      <p className="approval-reserve-label">Starting Bid</p>
                      <p className="approval-reserve-amount">
                        R {Number(item.startingBid || item.recommendedPrice || 0).toLocaleString("en-ZA")}
                      </p>
                    </div>

                    <div className="approval-actions">
                      <button
                        className="approval-btn approval-btn-reject"
                        onClick={(e) => handleReject(itemId, e)}
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
                        onClick={(e) => handleApprove(itemId, e)}
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
            );
          })}

        {!loading && approvals.length === 0 && (
          <div className="approvals-empty">
            <p>No pending approvals remaining.</p>
          </div>
        )}
      </div>

      {/* Detail Modal Pop-up */}
      {selectedTender && (
        <div className="approval-modal-overlay" onClick={() => setSelectedTender(null)}>
          <div className="approval-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="approval-modal-close" onClick={() => setSelectedTender(null)}>
              ✕
            </button>

            <div className="approval-modal-header">
              <h2>{selectedTender.assetName || selectedTender.title}</h2>
              <span className="approval-modal-badge">
                {selectedTender.tenderStatusName || selectedTender.assetStatusName || "Pending Review"}
              </span>
            </div>

            <div className="approval-modal-body">
              {(selectedTender.imageUrl || selectedTender.image) && (
                <div className="approval-modal-image-wrapper">
                  <img
                    src={selectedTender.imageUrl || selectedTender.image}
                    alt={selectedTender.assetName || selectedTender.title}
                    className="approval-modal-image"
                  />
                </div>
              )}

              <div className="approval-modal-grid">
                {/* Inventory Table Fields */}
                <div className="approval-modal-field">
                  <span className="field-label">Serial Number / Barcode</span>
                  <span className="field-value">{selectedTender.barcodeSerial || selectedTender.barcode || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Category</span>
                  <span className="field-value">{selectedTender.categoryName || selectedTender.category || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Department</span>
                  <span className="field-value">{selectedTender.departmentName || selectedTender.department || "N/A"}</span>
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
                    R {Number(selectedTender.recommendedPrice || 0).toLocaleString("en-ZA")}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Uploaded By</span>
                  <span className="field-value">{selectedTender.uploadedBy || "N/A"}</span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Condition</span>
                  <span className="field-value">{selectedTender.conditionName || selectedTender.conditionGrade || "N/A"}</span>
                </div>

                {/* Listing Table Fields */}
                <div className="approval-modal-field">
                  <span className="field-label">Starting Bid</span>
                  <span className="field-value price-value">
                    R {Number(selectedTender.startingBid || 0).toLocaleString("en-ZA")}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Leading Bid</span>
                  <span className="field-value price-value">
                    R {Number(selectedTender.leadingBid || selectedTender.startingBid || 0).toLocaleString("en-ZA")}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">Start Time</span>
                  <span className="field-value">
                    {selectedTender.startTime ? new Date(selectedTender.startTime).toLocaleString("en-ZA") : "N/A"}
                  </span>
                </div>

                <div className="approval-modal-field">
                  <span className="field-label">End Time</span>
                  <span className="field-value">
                    {selectedTender.endTime ? new Date(selectedTender.endTime).toLocaleString("en-ZA") : "N/A"}
                  </span>
                </div>

                {selectedTender.publishedDate && (
                  <div className="approval-modal-field">
                    <span className="field-label">Published Date</span>
                    <span className="field-value">
                      {new Date(selectedTender.publishedDate).toLocaleString("en-ZA")}
                    </span>
                  </div>
                )}

                {selectedTender.closedDate && (
                  <div className="approval-modal-field">
                    <span className="field-label">Closed Date</span>
                    <span className="field-value">
                      {new Date(selectedTender.closedDate).toLocaleString("en-ZA")}
                    </span>
                  </div>
                )}
              </div>

              {/* Text Areas */}
              <div className="approval-modal-section">
                <h4>Asset Description</h4>
                <p>{selectedTender.description || selectedTender.assetDescription || "No description provided."}</p>
              </div>

              <div className="approval-modal-section">
                <h4>Condition Notes</h4>
                <p>{selectedTender.conditionNotes || "No condition notes provided."}</p>
              </div>

              {selectedTender.rejectionReason && (
                <div className="approval-modal-section">
                  <h4>Rejection Reason</h4>
                  <p className="rejection-reason-text">{selectedTender.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="approval-modal-footer">
              <button
                className="approval-btn approval-btn-reject"
                onClick={(e) => handleReject(getItemId(selectedTender), e)}
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
                onClick={(e) => handleApprove(getItemId(selectedTender), e)}
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