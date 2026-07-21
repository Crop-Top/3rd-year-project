import { useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";

function PendingApprovals() {
  const [approvals, setApprovals] = useState([
    {
      id: 1,
      title: "2019 Toyota Corolla 1.6 Quest",
      description: "Asset description and tag information goes here.",
      reserve: 0,
      selected: false,
    },
    {
      id: 2,
      title: "Olympus CX23 Upright Microscope",
      description: "Asset description and tag information goes here.",
      reserve: 0,
      selected: false,
    },
    {
      id: 3,
      title: "Dell PowerEdge R740 Server Batch",
      description: "Asset description and tag information goes here.",
      reserve: 0,
      selected: false,
    },
    {
      id: 4,
      title: "2018 Isuzu D-Max 250 Single Cab",
      description: "Campus maintenance vehicle. Canopy included. Runs perfectly, shows typical work-related wear.",
      reserve: 115000,
      selected: false,
    },
  ]);

  const toggleSelect = (id) => {
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleApprove = (id) => {
    setApprovals((prev) => prev.filter((item) => item.id !== id));
  };

  const handleReject = (id) => {
    setApprovals((prev) => prev.filter((item) => item.id !== id));
  };

  const handleApproveSelected = () => {
    setApprovals((prev) => prev.filter((item) => !item.selected));
  };

  const handleRejectSelected = () => {
    setApprovals((prev) => prev.filter((item) => !item.selected));
  };

  const selectedCount = approvals.filter((item) => item.selected).length;

  return (
    <div className="approvals-page">
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
            disabled={selectedCount === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve Selected
          </button>
          <button
            className="approvals-bulk-btn approvals-bulk-reject"
            onClick={handleRejectSelected}
            disabled={selectedCount === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Reject Selected
          </button>
        </div>
      </div>

      <div className="approvals-list">
        {approvals.map((item) => (
          <div key={item.id} className="approval-card">
            <div className="approval-image-placeholder">
              <input
                type="checkbox"
                className="approval-checkbox"
                checked={item.selected}
                onChange={() => toggleSelect(item.id)}
              />
              <span className="approval-status-badge">Pending Review</span>
              {/* Image will be added here at a later stage */}
            </div>

            <div className="approval-details">
              <div className="approval-details-top">
                <h3 className="approval-title">{item.title}</h3>
                <a href="#!" className="approval-view-link">View Details &rarr;</a>
              </div>
              <p className="approval-description">{item.description}</p>

              <div className="approval-footer-row">
                <div className="approval-reserve">
                  <p className="approval-reserve-label">Proposed Reserve</p>
                  <p className="approval-reserve-amount">
                    R {item.reserve.toLocaleString()}
                  </p>
                </div>

                <div className="approval-actions">
                  <button
                    className="approval-btn approval-btn-reject"
                    onClick={() => handleReject(item.id)}
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

        {approvals.length === 0 && (
          <div className="approvals-empty">
            <p>No pending approvals remaining.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PendingApprovals;