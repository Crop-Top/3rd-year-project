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

function WinningBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Action button modal state ("Under Construction")
  const [showActionModal, setShowActionModal] = useState(false);

  // Detail view modal state
  const [selectedTenderDetails, setSelectedTenderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, total: 0 });

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
          setLoadError(err.message || "Failed to load winning bids.");
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

  // Fetch full tender details on card click
  const handleCardClick = async (id) => {
    if (!id) return;

    try {
      setLoadingDetails(true);
      setDetailsError("");
      
      const token = localStorage.getItem("token"); // Retrieve JWT token
      const response = await apiFetch(`${API_BASE_URL}/admin/tenders/${id}/edit-details`, {
        method: "GET",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });

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

  const handleActionClick = (e) => {
    e.stopPropagation(); // Prevents triggering card click modal
    setShowActionModal(true);
  };

  const closeActionModal = () => {
    setShowActionModal(false);
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
          <h1>My Winning Bids</h1>
          <p>View lots you have successfully won on closed tenders.</p>
        </div>

        {loading && <p>Loading your winning bids...</p>}
        {loadError && (
          <p style={{ color: "#b91c1c", fontWeight: "bold" }}>{loadError}</p>
        )}
        {!loading && !loadError && bids.length === 0 && (
          <p>You currently have no winning bids.</p>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="wb-list">
            {bids.map((bid) => {
              const lotId = bid.listingId || bid.id;
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
                        resolveImageUrl(bid.image) ||
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
                        <p>
                          <strong>SN:</strong> {bid.serial}
                        </p>
                        <p>Won: {bid.wonDate}</p>
                      </div>

                      <div className="wb-price-section">
                        <span className="wb-status verified">Won</span>
                        <small>Total Amount</small>
                        <h2>{formatRand(bid.amount)}</h2>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-btn wb-btn-primary"
                        onClick={handleActionClick}
                      >
                        Request Invoice
                      </button>
                      <button
                        type="button"
                        className="wb-btn wb-btn-secondary"
                        onClick={handleActionClick}
                      >
                        View Payment Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Loading Overlay when fetching tender details */}
      {loadingDetails && (
        <div className="wb-modal-overlay">
          <div className="wb-modal-content">
            <p>Loading details...</p>
          </div>
        </div>
      )}

      {/* Error Popup Modal if detail API fails */}
      {detailsError && (
        <div className="wb-modal-overlay" onClick={closeDetailsModal}>
          <div className="wb-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#b91c1c" }}>Error Loading Details</h2>
            <p>{detailsError}</p>
            <button
              type="button"
              className="wb-btn wb-btn-primary wb-modal-close-btn"
              onClick={closeDetailsModal}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tender Details Popup Modal */}
      {selectedTenderDetails && (
        <div className="wb-modal-overlay" onClick={closeDetailsModal}>
          <div
            className="wb-modal-content wb-details-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px", textAlign: "left" }}
          >
            <h2>{selectedTenderDetails.title}</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Listing ID: {selectedTenderDetails.listingId} | Asset ID: {selectedTenderDetails.assetId}
            </p>

            {selectedTenderDetails.imageUrl && (
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <img
                  src={resolveImageUrl(selectedTenderDetails.imageUrl)}
                  alt={selectedTenderDetails.title}
                  style={{ maxHeight: "200px", borderRadius: "8px", objectFit: "cover" }}
                />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <p><strong>Category:</strong> {selectedTenderDetails.categoryName || "N/A"}</p>
              <p><strong>Condition:</strong> {selectedTenderDetails.conditionName || "N/A"}</p>
              <p><strong>Department:</strong> {selectedTenderDetails.departmentName || "N/A"}</p>
              <p><strong>Location:</strong> {selectedTenderDetails.location || "N/A"}</p>
              <p><strong>Cost Center:</strong> {selectedTenderDetails.costCenter || "N/A"}</p>
              <p><strong>Barcode / Serial:</strong> {selectedTenderDetails.barcodeSerial || "N/A"}</p>
              <p><strong>Winning / Leading Bid:</strong> {formatRand(selectedTenderDetails.leadingBid)}</p>
              <p><strong>Starting Bid:</strong> {formatRand(selectedTenderDetails.startingBid)}</p>
              <p><strong>Uploaded By:</strong> {selectedTenderDetails.uploadedBy}</p>
              <p><strong>Status:</strong> {selectedTenderDetails.status}</p>
            </div>

            {selectedTenderDetails.description && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Description:</strong>
                <p style={{ marginTop: "0.25rem", color: "#444" }}>{selectedTenderDetails.description}</p>
              </div>
            )}

            {selectedTenderDetails.conditionNotes && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Condition Notes:</strong>
                <p style={{ marginTop: "0.25rem", color: "#444" }}>{selectedTenderDetails.conditionNotes}</p>
              </div>
            )}

            <div style={{ textAlign: "right", marginTop: "1.5rem" }}>
              <button
                type="button"
                className="wb-btn wb-btn-primary wb-modal-close-btn"
                onClick={closeDetailsModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Under Construction Popup Modal */}
      {showActionModal && (
        <div className="wb-modal-overlay" onClick={closeActionModal}>
          <div className="wb-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wb-modal-icon">🚧</div>
            <h2>Feature Under Construction</h2>
            <p>
              This feature is currently being developed and is not available yet.
              Please try again later or contact procurement for immediate assistance.
            </p>
            <button
              type="button"
              className="wb-btn wb-btn-primary wb-modal-close-btn"
              onClick={closeActionModal}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}

export default WinningBidsPage;