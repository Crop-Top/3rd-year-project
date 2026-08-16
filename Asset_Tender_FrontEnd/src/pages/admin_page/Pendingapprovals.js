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

  const toggleSelect = (id) => {
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleApprove = async (id) => {
    try {
      setBusyId(id);
      setError("");
      await approveTender(id);
      setApprovals((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setBusyId(id);
      setError("");
      await rejectTender(id);
      setApprovals((prev) => prev.filter((item) => item.id !== id));
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
            <div key={item.id} className="approval-card">
              <div className="approval-image-placeholder">
                <input
                  type="checkbox"
                  className="approval-checkbox"
                  checked={item.selected}
                  onChange={() => toggleSelect(item.id)}
                />
                <span className="approval-status-badge">Pending Review</span>
                {item.image ? (
                  <img src={item.image} alt={item.title} className="approval-image" />
                ) : null}
              </div>

              <div className="approval-details">
                <div className="approval-details-top">
                  <h3 className="approval-title">{item.title}</h3>
                  <span className="approval-view-link">{item.category}</span>
                </div>
                <p className="approval-description">{item.description}</p>

                <div className="approval-footer-row">
                  <div className="approval-reserve">
                    <p className="approval-reserve-label">Starting Bid</p>
                    <p className="approval-reserve-amount">
                      R {Number(item.leadingBid).toLocaleString("en-ZA")}
                    </p>
                  </div>

                  <div className="approval-actions">
                    <button
                      className="approval-btn approval-btn-reject"
                      onClick={() => handleReject(item.id)}
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
                      onClick={() => handleApprove(item.id)}
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
      <Portalfooter />
    </div>
  );
}

export default PendingApprovals;
