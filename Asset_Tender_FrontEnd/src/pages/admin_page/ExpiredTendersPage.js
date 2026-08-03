import { useEffect, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";
import {
  cancelExpiredTender,
  closeExpiredTender,
  getExpiredTenders,
  relistTender,
} from "../../services/assetService";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA");
};

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ExpiredTendersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [relistId, setRelistId] = useState(null);
  const [relistEndTime, setRelistEndTime] = useState("");

  const loadExpired = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getExpiredTenders();
      setItems(rows);
    } catch (err) {
      setError(err.message || "Failed to load expired tenders.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpired();
  }, []);

  const openRelist = (item) => {
    const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setRelistId(item.listingId);
    setRelistEndTime(toLocalInputValue(defaultEnd));
    setError("");
  };

  const handleRelist = async (listingId) => {
    if (!relistEndTime) {
      setError("Choose a new end date and time.");
      return;
    }

    const end = new Date(relistEndTime);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
      setError("New end time must be in the future.");
      return;
    }

    try {
      setBusyId(listingId);
      setError("");
      await relistTender(listingId, end.toISOString());
      setRelistId(null);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    } catch (err) {
      setError(err.message || "Relist failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (listingId) => {
    try {
      setBusyId(listingId);
      setError("");
      await closeExpiredTender(listingId);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    } catch (err) {
      setError(err.message || "Close failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (listingId) => {
    if (!window.confirm("Cancel this expired tender? It will leave the live queue permanently.")) {
      return;
    }

    try {
      setBusyId(listingId);
      setError("");
      await cancelExpiredTender(listingId);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    } catch (err) {
      setError(err.message || "Cancel failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="approvals-page">
      <div className="approvals-heading-row">
        <div>
          <h1 className="approvals-title">Expired Tenders</h1>
          <p className="approvals-subtitle">
            Auctions that passed their end time. Relist unsold lots, close winners, or cancel.
          </p>
        </div>
      </div>

      {error && <p className="approvals-error">{error}</p>}
      {loading && <p className="approvals-loading">Loading expired tenders...</p>}

      <div className="approvals-list">
        {!loading &&
          items.map((item) => (
            <div key={item.id} className="approval-card">
              <div className="approval-image-placeholder">
                <span className="approval-status-badge">
                  {item.hasBids ? "Expired — Has Bids" : "Expired — Unsold"}
                </span>
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
                <p className="approval-description" style={{ marginTop: "4px" }}>
                  Ended: {formatDateTime(item.endTime)}
                  {" · "}
                  {item.hasBids
                    ? `${item.bidCount} bid(s) · Leading ${formatRand(item.leadingBid)}`
                    : "No bids placed"}
                </p>

                {relistId === item.listingId && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <label htmlFor={`relist-end-${item.listingId}`} style={{ fontSize: "0.85rem" }}>
                      New end time
                    </label>
                    <input
                      id={`relist-end-${item.listingId}`}
                      type="datetime-local"
                      value={relistEndTime}
                      onChange={(e) => setRelistEndTime(e.target.value)}
                      disabled={busyId !== null}
                    />
                    <button
                      className="approval-btn approval-btn-approve"
                      onClick={() => handleRelist(item.listingId)}
                      disabled={busyId !== null}
                    >
                      Confirm Relist
                    </button>
                    <button
                      className="approval-btn approval-btn-reject"
                      onClick={() => setRelistId(null)}
                      disabled={busyId !== null}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="approval-footer-row">
                  <div className="approval-reserve">
                    <p className="approval-reserve-label">
                      {item.hasBids ? "Leading Bid" : "Starting Bid"}
                    </p>
                    <p className="approval-reserve-amount">
                      {formatRand(item.hasBids ? item.leadingBid : item.startingBid)}
                    </p>
                  </div>

                  <div className="approval-actions">
                    {!item.hasBids && relistId !== item.listingId && (
                      <button
                        className="approval-btn approval-btn-approve"
                        onClick={() => openRelist(item)}
                        disabled={busyId !== null}
                      >
                        Relist
                      </button>
                    )}
                    {item.hasBids && (
                      <button
                        className="approval-btn approval-btn-approve"
                        onClick={() => handleClose(item.listingId)}
                        disabled={busyId !== null}
                      >
                        Close as Won
                      </button>
                    )}
                    <button
                      className="approval-btn approval-btn-reject"
                      onClick={() => handleCancel(item.listingId)}
                      disabled={busyId !== null}
                    >
                      Cancel Tender
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {!loading && items.length === 0 && (
          <div className="approvals-empty">
            <p>No expired tenders awaiting action.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExpiredTendersPage;
