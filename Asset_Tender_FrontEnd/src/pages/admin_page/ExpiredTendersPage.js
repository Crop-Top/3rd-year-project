import { useEffect, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";

import {
  cancelExpiredTender,
  closeExpiredTender,
  disposeExpiredTender,
  getExpiredTenders,
  relistTender,
} from "../../services/assetService";
import Portalfooter from "../../components/Portalfooter";
import Portalheader from "../../components/Portalheader";

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

// Normalizes backend property names (supports camelCase, PascalCase, and AssetName/CategoryName)
const normalizeTender = (item) => ({
  listingId: item.listingId ?? item.ListingId ?? item.id ?? item.Id,
  title: item.assetName ?? item.AssetName ?? item.title ?? item.Title ?? "Untitled Tender",
  category: item.categoryName ?? item.CategoryName ?? item.category ?? item.Category ?? "General",
  description: item.description ?? item.Description ?? "",
  endTime: item.endTime ?? item.EndTime,
  hasBids: Boolean(item.hasBids ?? item.HasBids ?? (item.bidCount > 0 || item.BidCount > 0)),
  bidCount: item.bidCount ?? item.BidCount ?? 0,
  leadingBid: item.leadingBid ?? item.LeadingBid ?? 0,
  startingBid: item.startingBid ?? item.StartingBid ?? 0,
  image: item.image ?? item.Image ?? item.imageUrl ?? item.ImageUrl ?? null,
});

function ExpiredTendersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [relistId, setRelistId] = useState(null);
  const [relistEndTime, setRelistEndTime] = useState("");
  const [selectedTender, setSelectedTender] = useState(null);

  const loadExpired = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getExpiredTenders();
      
      const rawList = Array.isArray(res) ? res : res?.data || res?.items || res?.result || [];
      const normalizedList = rawList.map(normalizeTender);

      setItems(normalizedList);
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
      setSelectedTender(null);
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
      setSelectedTender(null);
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
      setSelectedTender(null);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    } catch (err) {
      setError(err.message || "Cancel failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDispose = async (listingId, disposition) => {
    if (!window.confirm(`Mark this unsold asset as ${disposition}? It will leave the auction queue.`)) {
      return;
    }

    try {
      setBusyId(listingId);
      setError("");
      await disposeExpiredTender(listingId, disposition);
      setSelectedTender(null);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    } catch (err) {
      setError(err.message || `Failed to mark as ${disposition}.`);
    } finally {
      setBusyId(null);
    }
  };

  const renderActionButtons = (item) => (
    <div className="approval-actions" style={{ flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      {!item.hasBids && relistId !== item.listingId && (
        <>
          <button
            className="approval-btn approval-btn-approve"
            onClick={() => openRelist(item)}
            disabled={busyId !== null}
          >
            Relist
          </button>
          <button
            className="approval-btn approval-btn-approve"
            onClick={() => handleDispose(item.listingId, "Donation")}
            disabled={busyId !== null}
          >
            Mark Donation
          </button>
          <button
            className="approval-btn approval-btn-reject"
            onClick={() => handleDispose(item.listingId, "Scrap")}
            disabled={busyId !== null}
          >
            Mark Scrap
          </button>
        </>
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
  );

  const renderRelistSection = (item) => (
    relistId === item.listingId && (
      <div 
        style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
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
    )
  );

  return (
    <div className="approvals-page">
      <Portalheader />

      {/* Everything between the header and footer now lives inside
          .approvals-content — previously this markup was a direct child
          of .approvals-page, so the max-width/margin rule on
          .approvals-content had no element to apply to and did nothing. */}
      <div className="approvals-content">
        <div className="approvals-heading-row">
          <div>
            <h1 className="approvals-title">Expired Tenders</h1>
            <p className="approvals-subtitle">
              Auctions that passed their end time. Relist unsold lots, flag as Donation/Scrap, close winners, or cancel.
            </p>
          </div>
        </div>

        {error && <p className="approvals-error">{error}</p>}
        {loading && <p className="approvals-loading">Loading expired tenders...</p>}

        <div className="approvals-list">
          {!loading &&
            items.map((item) => (
              <div
                key={item.listingId}
                className="approval-card"
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedTender(item)}
              >
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

                  {renderRelistSection(item)}

                  <div className="approval-footer-row">
                    <div className="approval-reserve">
                      <p className="approval-reserve-label">
                        {item.hasBids ? "Leading Bid" : "Starting Bid"}
                      </p>
                      <p className="approval-reserve-amount">
                        {formatRand(item.hasBids ? item.leadingBid : item.startingBid)}
                      </p>
                    </div>

                    {renderActionButtons(item)}
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

      {/* Tender Modal */}
      {selectedTender && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
          onClick={() => setSelectedTender(null)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              position: "relative",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer"
              }}
              onClick={() => setSelectedTender(null)}
            >
              &times;
            </button>

            {selectedTender.image && (
              <img
                src={selectedTender.image}
                alt={selectedTender.title}
                style={{ width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "6px", marginBottom: "16px" }}
              />
            )}

            <h2>{selectedTender.title}</h2>
            <p style={{ color: "#666", marginBottom: "12px" }}>Category: {selectedTender.category}</p>

            <div style={{ margin: "16px 0", lineHeight: "1.5" }}>
              <p><strong>Description:</strong> {selectedTender.description || "N/A"}</p>
              <p><strong>Ended:</strong> {formatDateTime(selectedTender.endTime)}</p>
              <p><strong>Status:</strong> {selectedTender.hasBids ? "Expired — Has Bids" : "Expired — Unsold"}</p>
              <p>
                <strong>Bids:</strong> {selectedTender.hasBids
                  ? `${selectedTender.bidCount} bid(s) · Leading ${formatRand(selectedTender.leadingBid)}`
                  : "No bids placed"}
              </p>
              <p>
                <strong>{selectedTender.hasBids ? "Leading Bid:" : "Starting Bid:"}</strong>{" "}
                {formatRand(selectedTender.hasBids ? selectedTender.leadingBid : selectedTender.startingBid)}
              </p>
            </div>

            {renderRelistSection(selectedTender)}

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              {renderActionButtons(selectedTender)}
            </div>
          </div>
        </div>
      )}

      <Portalfooter />
    </div>
  );
}

export default ExpiredTendersPage;