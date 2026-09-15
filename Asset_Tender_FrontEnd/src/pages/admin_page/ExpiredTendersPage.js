import { useEffect, useMemo, useState } from "react";
import "../../styles/admin_style/PendingApprovals.css";

import {
  cancelExpiredTender,
  closeExpiredTender,
  getExpiredTenders,
  relistTender,
  uploadProofOfPayment,
} from "../../services/assetService";
import { getCurrentUser } from "../../services/authService";
import Portalfooter from "../../components/Portalfooter";
import Portalheader from "../../components/Portalheader";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA");
};

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const normalizeTender = (item) => {
  const listingId = (item.listingId ?? item.ListingId) ?? (item.id ?? item.Id);
  const title =
    (item.assetName ?? item.AssetName) ??
    (item.title ?? item.Title ?? item.lotTitle ?? item.LotTitle ?? "Untitled Tender");
  const category =
    (item.categoryName ?? item.CategoryName) ??
    (item.category ?? item.Category ?? "General");
  const totalOffers =
    ((item.totalOffers ?? item.TotalOffers) ?? item.bidCount) ??
    (item.BidCount ?? 0);
  const startingBid =
    ((item.startingBid ?? item.StartingBid) ?? item.recommendedBid) ?? 0;

  const winningBidObj = item.winningBid ?? item.WinningBid ?? {};
  const paymentStatus =
    (((item.paymentStatus ?? item.PaymentStatus) ?? item.winningBidStatus) ??
      item.WinningBidStatus) ||
    (winningBidObj.status ?? winningBidObj.Status) ||
    (item.Status && item.LotTitle ? item.Status : "Unsold");

  const hasProofOfPayment = Boolean(
    (item.hasProofOfPayment ?? item.HasProofOfPayment) ||
      paymentStatus === "Paid" ||
      paymentStatus === "Claimed"
  );

  const isClosedAsWon = Boolean(
    (item.isClosedAsWon ?? item.IsClosedAsWon) ||
      (item.awardedUserID ?? item.AwardedUserID) ||
      item.winnerName
  );

  return {
    listingId,
    title,
    category,
    description: item.description ?? item.Description ?? "",
    endTime: item.endTime ?? item.EndTime ?? null,
    hasBids: Boolean(
      (item.hasBids ?? item.HasBids) || totalOffers > 0 || isClosedAsWon
    ),
    totalOffers,
    startingBid,
    reservePrice: startingBid,
    image:
      (((item.image ?? item.Image) ?? item.imageUrl) ?? item.ImageUrl) ?? null,
    isClosedAsWon,
    hasProofOfPayment,
    paymentStatus,
    isClosed:
      paymentStatus === "Paid" ||
      paymentStatus === "Claimed" ||
      Boolean(item.isClosed ?? item.IsClosed),
    invoiceId: item.invoiceId ?? item.InvoiceId ?? null,
    winningBidAmount:
      ((item.winningBidAmount ?? item.WinningBidAmount) ?? item.amount) ??
      (item.Amount ?? null),
    winnerName:
      ((item.winnerName ?? item.WinnerName) ?? item.userName) ??
      (item.UserName ?? null),
  };
};

const isVehicleCategory = (category = "") => {
  const lower = category.toLowerCase();
  return (
    lower.includes("vehicle") ||
    lower.includes("automotive") ||
    lower.includes("car")
  );
};

const tabButtonStyle = (active) => ({
  background: "none",
  border: "none",
  borderBottom: active ? "3px solid #2563eb" : "3px solid transparent",
  color: active ? "#0f172a" : "#64748b",
  fontWeight: active ? 700 : 500,
  fontSize: "0.95rem",
  padding: "10px 14px",
  cursor: "pointer",
  marginBottom: "-1px",
});

function ExpiredTendersPage() {
  const currentUser = getCurrentUser() || {};
  const isSuperAdmin =
    String(currentUser.role || "").toLowerCase() === "superadmin";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [relistId, setRelistId] = useState(null);
  const [relistEndTime, setRelistEndTime] = useState("");
  const [selectedTender, setSelectedTender] = useState(null);

  const [activeTab, setActiveTab] = useState("all"); // all | pending | unsold | closed
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [popListing, setPopListing] = useState(null);
  const [popFile, setPopFile] = useState(null);
  const [popError, setPopError] = useState("");
  const [popUploading, setPopUploading] = useState(false);

  const loadExpired = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getExpiredTenders();
      const rawList = Array.isArray(res)
        ? res
        : res?.data || res?.items || res?.result || [];
      setItems(rawList.map(normalizeTender));
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

  const searchFilteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesId = String(item.listingId).toLowerCase().includes(query);
        if (!matchesTitle && !matchesId) return false;
      }

      if (item.endTime) {
        const itemDate = new Date(item.endTime).getTime();
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (itemDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end.getTime()) return false;
        }
      }

      return true;
    });

    // Sort newest to oldest by endTime (fallback to listingId descending)
    return filtered.sort((a, b) => {
      const timeA = a.endTime ? new Date(a.endTime).getTime() : 0;
      const timeB = b.endTime ? new Date(b.endTime).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.listingId || 0) - Number(a.listingId || 0);
    });
  }, [items, searchQuery, startDate, endDate]);

  const isPaidOrClosed = (i) =>
    i.hasProofOfPayment ||
    i.isClosed ||
    i.paymentStatus === "Paid" ||
    i.paymentStatus === "Claimed";

  const isPendingWinner = (i) =>
    (i.hasBids || i.isClosedAsWon) && !isPaidOrClosed(i);

  const tabCounts = useMemo(() => {
    const closed = searchFilteredItems.filter(isPaidOrClosed).length;
    const pending = searchFilteredItems.filter(isPendingWinner).length;
    const unsold = searchFilteredItems.filter(
      (i) => !i.hasBids && !i.isClosedAsWon && !isPaidOrClosed(i)
    ).length;

    return {
      all: searchFilteredItems.length,
      pending,
      unsold,
      closed,
    };
  }, [searchFilteredItems]);

  const filteredItems = useMemo(() => {
    if (activeTab === "pending") {
      return searchFilteredItems.filter(isPendingWinner);
    }
    if (activeTab === "unsold") {
      return searchFilteredItems.filter(
        (i) => !i.hasBids && !i.isClosedAsWon && !isPaidOrClosed(i)
      );
    }
    if (activeTab === "closed") {
      return searchFilteredItems.filter(isPaidOrClosed);
    }
    return searchFilteredItems;
  }, [searchFilteredItems, activeTab]);

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

  const handleClose = async (item) => {
    try {
      setBusyId(item.listingId);
      setError("");
      await closeExpiredTender(item.listingId);
      setSelectedTender(null);
      await loadExpired();
      openPopUpload(item);
    } catch (err) {
      setError(err.message || "Close failed.");
    } finally {
      setBusyId(null);
    }
  };

  const openPopUpload = (item) => {
    setPopListing(item);
    setPopFile(null);
    setPopError("");
  };

  const closePopUpload = () => {
    if (popUploading) return;
    setPopListing(null);
    setPopFile(null);
    setPopError("");
  };

  const isAllowedPopFile = (file) => {
    const name = (file.name || "").toLowerCase();
    const type = (file.type || "").toLowerCase();
    return (
      name.endsWith(".pdf") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      type === "application/pdf" ||
      type === "image/jpeg" ||
      type === "image/jpg" ||
      type === "image/png"
    );
  };

  const handlePopUpload = async () => {
    if (!popListing) return;
    if (!popFile) {
      setPopError("Choose a proof of payment file (PDF, JPG, or PNG).");
      return;
    }
    if (!isAllowedPopFile(popFile)) {
      setPopError("Proof of payment must be a PDF, JPG, or PNG file.");
      return;
    }

    try {
      setPopUploading(true);
      setPopError("");
      setBusyId(popListing.listingId);
      await uploadProofOfPayment(popListing.listingId, popFile);
      setPopListing(null);
      setPopFile(null);
      setSelectedTender(null);
      await loadExpired();
    } catch (err) {
      setPopError(err.message || "Failed to upload proof of payment.");
    } finally {
      setPopUploading(false);
      setBusyId(null);
    }
  };

  const handleCancel = async (listingId) => {
    if (
      !window.confirm(
        "Cancel this expired tender? It will leave the live queue permanently."
      )
    ) {
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

  const renderActionButtons = (item) => (
    <div
      className="approval-actions"
      style={{ flexWrap: "wrap", gap: "8px", alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
    >
      {isPaidOrClosed(item) ? (
        <>
          <span
            style={{
              alignSelf: "center",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#166534",
              background: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: "6px",
              padding: "4px 8px",
            }}
          >
            Completed / Paid
          </span>
          {isSuperAdmin && (
            <button
              type="button"
              className="approval-btn approval-btn-approve"
              onClick={() => openPopUpload(item)}
              disabled={busyId !== null}
            >
              Upload POP
            </button>
          )}
        </>
      ) : (
        <>
          {item.isClosedAsWon && !item.hasProofOfPayment && (
            <>
              <span
                style={{
                  alignSelf: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#92400e",
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  borderRadius: "6px",
                  padding: "4px 8px",
                }}
              >
                Awaiting POP
                {item.winnerName ? ` · ${item.winnerName}` : ""}
              </span>
              {isSuperAdmin && (
                <button
                  type="button"
                  className="approval-btn approval-btn-approve"
                  onClick={() => openPopUpload(item)}
                  disabled={busyId !== null}
                >
                  Upload POP
                </button>
              )}
            </>
          )}

          {!item.isClosedAsWon && !item.hasBids && relistId !== item.listingId && (
            <button
              type="button"
              className="approval-btn approval-btn-approve"
              onClick={() => openRelist(item)}
              disabled={busyId !== null}
            >
              Relist
            </button>
          )}

          {!item.isClosedAsWon && item.hasBids && (
            <button
              type="button"
              className="approval-btn approval-btn-approve"
              onClick={() => handleClose(item)}
              disabled={busyId !== null}
            >
              Close as Won
            </button>
          )}

          {!item.isClosedAsWon && (
            <button
              type="button"
              className="approval-btn approval-btn-reject"
              onClick={() => handleCancel(item.listingId)}
              disabled={busyId !== null}
            >
              Cancel Tender
            </button>
          )}
        </>
      )}
    </div>
  );

  const renderRelistSection = (item) =>
    relistId === item.listingId ? (
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <label
          htmlFor={`relist-end-${item.listingId}`}
          style={{ fontSize: "0.85rem" }}
        >
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
          type="button"
          className="approval-btn approval-btn-approve"
          onClick={() => handleRelist(item.listingId)}
          disabled={busyId !== null}
        >
          Confirm Relist
        </button>
        <button
          type="button"
          className="approval-btn approval-btn-reject"
          onClick={() => setRelistId(null)}
          disabled={busyId !== null}
        >
          Cancel
        </button>
      </div>
    ) : null;

  return (
    <div className="approvals-page">
      <Portalheader />

      <div className="approvals-content">
        <div className="approvals-heading-row">
          <div>
            <h1 className="approvals-title">Expired Tenders</h1>
            <p className="approvals-subtitle">
              Auctions that passed their end time. Relist unsold lots, close
              winners, upload proof of payment, or cancel.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "4px",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            style={tabButtonStyle(activeTab === "all")}
            onClick={() => setActiveTab("all")}
          >
            All Expired ({tabCounts.all})
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === "pending")}
            onClick={() => setActiveTab("pending")}
          >
            Pending Winner Processing ({tabCounts.pending})
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === "unsold")}
            onClick={() => setActiveTab("unsold")}
          >
            Unsold Lots ({tabCounts.unsold})
          </button>
          <button
            type="button"
            style={tabButtonStyle(activeTab === "closed")}
            onClick={() => setActiveTab("closed")}
          >
            Paid / Claimed / Closed ({tabCounts.closed})
          </button>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Search by tender name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: "1 1 220px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
              }}
            />
          </div>
          {(searchQuery || startDate || endDate) && (
            <button
              type="button"
              className="approval-btn"
              style={{ padding: "8px 12px", fontSize: "0.85rem" }}
              onClick={() => {
                setSearchQuery("");
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {error && <p className="approvals-error">{error}</p>}
        {loading && (
          <p className="approvals-loading">Loading expired tenders...</p>
        )}

        <div className="approvals-list">
          {!loading &&
            filteredItems.map((item) => (
              <div
                key={item.listingId}
                className="approval-card"
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedTender(item)}
              >
                <div className="approval-image-placeholder">
                  <span className="approval-status-badge">
                    {isPaidOrClosed(item)
                      ? "Paid / Claimed / Closed"
                      : item.isClosedAsWon
                      ? "Closed as Won — Awaiting POP"
                      : item.hasBids
                      ? "Expired — Has Bids"
                      : "Expired — Unsold"}
                  </span>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="approval-image"
                    />
                  ) : null}
                </div>

                <div className="approval-details">
                  <div className="approval-details-top">
                    <h3 className="approval-title">
                      {item.title}{" "}
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        (ID: {item.listingId})
                      </span>
                    </h3>
                    <span className="approval-view-link">{item.category}</span>
                  </div>
                  <p className="approval-description">{item.description}</p>
                  <p
                    className="approval-description"
                    style={{ marginTop: "4px" }}
                  >
                    Ended: {formatDateTime(item.endTime)}
                    {" · "}
                    Total Offers: {item.totalOffers}
                  </p>

                  {renderRelistSection(item)}

                  <div className="approval-footer-row">
                    <div
                      className="approval-reserve"
                      style={{ display: "flex", gap: "16px" }}
                    >
                      {isVehicleCategory(item.category) && (
                        <div>
                          <p className="approval-reserve-label">
                            Reserve Price
                          </p>
                          <p className="approval-reserve-amount">
                            {formatRand(item.reservePrice)}
                          </p>
                        </div>
                      )}
                    </div>

                    {renderActionButtons(item)}
                  </div>
                </div>
              </div>
            ))}

          {!loading && filteredItems.length === 0 && (
            <div className="approvals-empty">
              <p>No expired tenders found matching your filter criteria.</p>
            </div>
          )}
        </div>
      </div>

      {selectedTender && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
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
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
              onClick={() => setSelectedTender(null)}
            >
              &times;
            </button>

            {selectedTender.image && (
              <img
                src={selectedTender.image}
                alt={selectedTender.title}
                style={{
                  width: "100%",
                  maxHeight: "300px",
                  objectFit: "cover",
                  borderRadius: "6px",
                  marginBottom: "16px",
                }}
              />
            )}

            <h2>
              {selectedTender.title}{" "}
              <span style={{ fontSize: "0.9rem", color: "#64748b" }}>
                (ID: {selectedTender.listingId})
              </span>
            </h2>
            <p style={{ color: "#666", marginBottom: "12px" }}>
              Category: {selectedTender.category}
            </p>

            <div style={{ margin: "16px 0", lineHeight: "1.5" }}>
              <p>
                <strong>Description:</strong>{" "}
                {selectedTender.description || "N/A"}
              </p>
              <p>
                <strong>Ended:</strong> {formatDateTime(selectedTender.endTime)}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {isPaidOrClosed(selectedTender)
                  ? "Paid / Claimed / Closed"
                  : selectedTender.isClosedAsWon
                  ? "Closed as Won — Awaiting POP"
                  : selectedTender.hasBids
                  ? "Expired — Has Bids"
                  : "Expired — Unsold"}
              </p>
              <p>
                <strong>Total Offers:</strong> {selectedTender.totalOffers}
              </p>
              {selectedTender.isClosedAsWon && selectedTender.winnerName && (
                <p>
                  <strong>Winner:</strong> {selectedTender.winnerName}
                </p>
              )}
              {selectedTender.isClosedAsWon &&
                selectedTender.winningBidAmount != null && (
                  <p>
                    <strong>Winning Bid:</strong>{" "}
                    {formatRand(selectedTender.winningBidAmount)}
                  </p>
                )}
              {isVehicleCategory(selectedTender.category) && (
                <p>
                  <strong>Reserve Price:</strong>{" "}
                  {formatRand(selectedTender.reservePrice)}
                </p>
              )}
            </div>

            {renderRelistSection(selectedTender)}

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              {renderActionButtons(selectedTender)}
            </div>
          </div>
        </div>
      )}

      {popListing && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
          onClick={closePopUpload}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              position: "relative",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
              Upload Proof of Payment
            </h2>
            <p style={{ color: "#64748b", marginTop: 0 }}>
              {popListing.title} (ID: {popListing.listingId})
              {popListing.winnerName
                ? ` · Winner: ${popListing.winnerName}`
                : ""}
            </p>
            <p style={{ fontSize: "0.9rem" }}>
              Upload the PDF or image scan brought to Procurement (PDF, JPG, or
              PNG). This will mark payment as Verified.
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              onChange={(e) => {
                setPopFile(e.target.files?.[0] || null);
                setPopError("");
              }}
              disabled={popUploading}
            />
            {popFile && (
              <p style={{ fontSize: "0.85rem", color: "#334155" }}>
                Selected: {popFile.name}
              </p>
            )}
            {popError && (
              <p style={{ color: "#b91c1c", fontSize: "0.9rem" }} role="alert">
                {popError}
              </p>
            )}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="approval-btn approval-btn-reject"
                onClick={closePopUpload}
                disabled={popUploading}
              >
                Do This Later
              </button>
              <button
                type="button"
                className="approval-btn approval-btn-approve"
                onClick={handlePopUpload}
                disabled={popUploading || !popFile}
                style={{
                  opacity: popUploading || !popFile ? 0.5 : 1,
                  cursor: popUploading || !popFile ? "not-allowed" : "pointer",
                }}
              >
                {popUploading ? "Uploading…" : "Upload POP"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Portalfooter />
    </div>
  );
}

export default ExpiredTendersPage;