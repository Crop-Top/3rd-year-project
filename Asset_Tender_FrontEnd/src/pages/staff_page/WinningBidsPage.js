import React, { useEffect, useState } from "react";
import PortalheaderS from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/staff_style/WinningBidsPage.css";
import { getWinningBids } from "../../services/winningBidsService.js";
import { resolveImageUrl } from "../../services/assetService.js";
import { API_BASE_URL, apiFetch } from "../../services/apiClient.js";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Pipeline steps for post-auction workflow
const PIPELINE_STEPS = [
  { key: "PendingPayment", label: "Payment Due" },
  { key: "PaymentVerified", label: "Payment Verified" },
  { key: "ReadyForCollection", label: "Ready for Pickup" },
  { key: "Collected", label: "Collected & Closed" },
];

function StatusPipelineTracker({ status }) {
  const getStepIndex = (currentStatus) => {
    switch (currentStatus?.toLowerCase()) {
      case "pendingpayment":
      case "won":
      case "awaitingpayment":
        return 0;
      case "paymentreceived":
      case "paymentverified":
        return 1;
      case "readyforcollection":
      case "pendingcollection":
        return 2;
      case "collected":
      case "closed":
      case "completed":
        return 3;
      default:
        return 0;
    }
  };

  const activeIndex = getStepIndex(status);

  return (
    <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        {PIPELINE_STEPS.map((step, idx) => {
          const isDone = idx <= activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div key={step.key} style={{ flex: 1, textAlign: "center", position: "relative", zIndex: 1 }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: isDone ? "#2563eb" : "#cbd5e1",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 4px auto",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  boxShadow: isCurrent ? "0 0 0 3px #bfdbfe" : "none",
                }}
              >
                {idx + 1}
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: isCurrent ? "600" : "400", color: isCurrent ? "#1e293b" : "#64748b" }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WinningBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Action Modal State
  const [actionModal, setActionModal] = useState({ show: false, type: "", item: null });

  // Detail View State
  const [selectedTenderDetails, setSelectedTenderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBids() {
      try {
        setLoading(true);
        setLoadError("");
        const data = await getWinningBids();
        if (!cancelled && data) {
          setBids(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load winning offers.");
          setBids([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBids();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = async (id) => {
    if (!id) return;

    try {
      setLoadingDetails(true);
      setDetailsError("");

      const token = localStorage.getItem("token");
      const response = await apiFetch(
        `${API_BASE_URL}/tenders/${id}/details`,
        {
          method: "GET",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to retrieve details (Status: ${response.status})`);
      }

      const data = await response.json();
      setSelectedTenderDetails(data);
    } catch (err) {
      setDetailsError(err.message || "Unable to fetch tender details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const openActionModal = (e, type, item) => {
    e.stopPropagation();
    setActionModal({ show: true, type, item });
  };

  const closeActionModal = () => {
    setActionModal({ show: false, type: "", item: null });
  };

  const closeDetailsModal = () => {
    setSelectedTenderDetails(null);
    setDetailsError("");
  };

  return (
    <div className="wb-page">
      <PortalheaderS />

      <main className="wb-main">
        <div className="wb-header">
          <h1>My Winning Offers</h1>
          <p>Track your awarded tenders, payment verification, and collection schedules.</p>
        </div>

        {loading && <p>Loading your winning offers...</p>}
        {loadError && <p style={{ color: "#b91c1c", fontWeight: "bold" }}>{loadError}</p>}
        {!loading && !loadError && bids.length === 0 && (
          <p>You currently have no winning offers.</p>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="wb-list">
            {bids.map((bid) => {
              const lotId = bid.listingId || bid.id;
              const rawCategory = bid.categoryName || bid.category || bid.assetCategory || "";
              const isVehicleCategory =
                rawCategory.toLowerCase().includes("vehicle") ||
                rawCategory.toLowerCase().includes("car");

              const reservePrice =
                bid.startingBid ??
                bid.reservePrice ??
                bid.reserveAmount ??
                bid.startingPrice;

              const isDefaulted = bid.status === "Defaulted" || bid.isDefaulted;

              return (
                <div
                  className="wb-card wb-card-clickable"
                  key={bid.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardClick(lotId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(lotId);
                    }
                  }}
                >
                  <div className="wb-image">
                    <img
                      src={
                        resolveImageUrl(bid.image || bid.imageUrl) ||
                        "https://via.placeholder.com/300x200?text=No+Image"
                      }
                      alt={bid.title}
                    />
                  </div>

                  <div className="wb-info">
                    <div className="wb-top-row">
                      <div>
                        <h3>
                          Lot {lotId}: {bid.title}
                        </h3>
                        <p><strong>SN:</strong> {bid.serial || "N/A"}</p>

                        {isVehicleCategory && reservePrice !== undefined && (
                          <p className="tender-description" style={{ marginBottom: "4px", color: "#334155" }}>
                            Reserve Price: <strong>{formatRand(reservePrice)}</strong>
                          </p>
                        )}

                        <p>Won Date: {bid.wonDate || "Recent"}</p>
                      </div>

                      <div className="wb-price-section">
                        <span className={`wb-status ${isDefaulted ? "rejected" : "verified"}`}>
                          {isDefaulted ? "Defaulted" : bid.status || "Won"}
                        </span>
                        <small>Winning Offer</small>
                        <h2>{formatRand(bid.amount)}</h2>
                      </div>
                    </div>

                    {/* Integrated Status Tracker or Default Banner */}
                    {isDefaulted ? (
                      <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px" }}>
                        <p style={{ color: "#991b1b", fontSize: "0.85rem", margin: 0 }}>
                          <strong>Order Cancelled:</strong> Payment window expired. This item has been offered to the runner-up or relisted.
                        </p>
                      </div>
                    ) : (
                      <StatusPipelineTracker status={bid.status || "Won"} />
                    )}

                    <div className="wb-actions" style={{ marginTop: "16px" }}>
                      <button
                        type="button"
                        className="wb-btn wb-btn-primary"
                        disabled={isDefaulted}
                        onClick={(e) => openActionModal(e, "Invoice", bid)}
                      >
                        Download Invoice
                      </button>
                      <button
                        type="button"
                        className="wb-btn wb-btn-secondary"
                        disabled={isDefaulted}
                        onClick={(e) => openActionModal(e, "Payment", bid)}
                      >
                        Upload Proof of Payment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Action Modals for Payment & Invoices */}
      {actionModal.show && (
        <div className="wb-modal-overlay" onClick={closeActionModal}>
          <div className="wb-modal-content" onClick={(e) => e.stopPropagation()}>
            {actionModal.type === "Invoice" ? (
              <>
                <h2>Tax Invoice - Lot {actionModal.item?.listingId || actionModal.item?.id}</h2>
                <p>Generating formal tax invoice for <strong>{actionModal.item?.title}</strong>...</p>
                <div style={{ margin: "16px 0", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
                  <p><strong>Total Due:</strong> {formatRand(actionModal.item?.amount)}</p>
                  <p><strong>Banking Reference:</strong> TEN-{actionModal.item?.listingId}</p>
                </div>
                <button type="button" className="wb-btn wb-btn-primary" onClick={closeActionModal}>
                  Download PDF
                </button>
              </>
            ) : (
              <>
                <h2>Upload Proof of Payment</h2>
                <p>Attach your bank deposit receipt or EFT confirmation below for verification.</p>
                <input type="file" accept=".pdf,.png,.jpg" style={{ margin: "16px 0", display: "block" }} />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button type="button" className="wb-btn wb-btn-secondary" onClick={closeActionModal}>
                    Cancel
                  </button>
                  <button type="button" className="wb-btn wb-btn-primary" onClick={closeActionModal}>
                    Submit Proof
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedTenderDetails && (
        <div className="wb-modal-overlay" onClick={closeDetailsModal}>
          <div className="wb-modal-content wb-details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", textAlign: "left" }}>
            <h2>{selectedTenderDetails.title}</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Listing ID: {selectedTenderDetails.listingId} | Asset ID: {selectedTenderDetails.assetId}
            </p>

            <StatusPipelineTracker status={selectedTenderDetails.status || "Won"} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0" }}>
              <p><strong>Category:</strong> {selectedTenderDetails.categoryName || "N/A"}</p>
              <p><strong>Condition:</strong> {selectedTenderDetails.conditionName || "N/A"}</p>
              <p><strong>Location:</strong> {selectedTenderDetails.location || "N/A"}</p>
              <p><strong>Winning Offer:</strong> {formatRand(selectedTenderDetails.leadingBid || selectedTenderDetails.amount)}</p>
            </div>

            <div style={{ textAlign: "right", marginTop: "1.5rem" }}>
              <button type="button" className="wb-btn wb-btn-primary" onClick={closeDetailsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}

export default WinningBidsPage;