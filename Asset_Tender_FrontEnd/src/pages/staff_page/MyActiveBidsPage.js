import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyActiveBids, resolveImageUrl } from "../../services/assetService.js";
import PortalheaderS from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Time calculation helper supporting ISO dates or closesInHours fallback
function getTimeRemaining(endTime, closesInHours) {
  if (!endTime && (closesInHours == null || closesInHours <= 0)) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }

  if (endTime) {
    const formattedTime = String(endTime).trim().replace(" ", "T");
    const total = Date.parse(formattedTime) - Date.now();

    if (!isNaN(total) && total > 0) {
      const minutes = Math.floor((total / 1000 / 60) % 60);
      const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
      const days = Math.floor(total / (1000 * 60 * 60 * 24));
      return { days, hours, minutes, expired: false };
    }
  }

  // Fallback to integer hours if ISO string fails or is omitted
  const totalHours = Number(closesInHours || 0);
  if (totalHours <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };

  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  return { days, hours, minutes: 0, expired: false };
}

// Skeleton loader component
function SkeletonCard() {
  return (
    <div className="tender-card skeleton-card">
      <div className="skeleton-image" />
      <div className="skeleton-content">
        <div className="skeleton-line title" />
        <div className="skeleton-line category" />
        <div className="skeleton-line description" />
        <div className="skeleton-row">
          <div className="skeleton-line price" />
          <div className="skeleton-line btn" />
        </div>
      </div>
    </div>
  );
}

function MyActiveBidsPage() {
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [, setTick] = useState(0);

  // Interval trigger to update countdown calculations every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBids() {
      try {
        setLoading(true);
        setLoadError("");
        const data = await getMyActiveBids();
        if (!cancelled) setBids(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load your bids.");
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

  const goToAsset = (id) => {
    if (id) navigate(`/asset/${id}`);
  };

  const filteredBids = bids.filter((bid) => {
    const title = bid.assetName || bid.title || "";
    const category = bid.categoryName || bid.category || "";
    const query = searchTerm.toLowerCase();
    return title.toLowerCase().includes(query) || category.toLowerCase().includes(query);
  });

  return (
    <div className="browse-page-container">
      <PortalheaderS 
        searchTerm={searchTerm} 
        onSearchChange={(e) => setSearchTerm(e.target.value)} 
      />

      <main className="portal-content">
        <div className="content-heading-row">
          <h1>My Active Offers</h1>
        </div>

        {/* 1. Loading State */}
        {loading && (
          <div className="tender-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))}
          </div>
        )}
        
        {/* 2. Error State */}
        {!loading && loadError && (
          <div className="tender-empty">
            <p style={{ color: "#b91c1c" }}>{loadError}</p>
          </div>
        )}

        {/* 3. Empty Bids State */}
        {!loading && !loadError && bids.length === 0 && (
          <div className="tender-empty">
            <p>You haven't submitted any offers on open lots yet.</p>
          </div>
        )}

        {/* 4. Empty Search Result State */}
        {!loading && !loadError && bids.length > 0 && filteredBids.length === 0 && (
          <div className="tender-empty">
            <p>No active bids match your search query "{searchTerm}".</p>
          </div>
        )}

        {/* 5. Render Loaded Bids */}
        {!loading && !loadError && filteredBids.length > 0 && (
          <div className="tender-grid">
            {filteredBids.map((bid) => {
              const lotId = bid.listingId || bid.id;
              const lotTitle = bid.assetName || bid.title || "Asset Lot";
              const lotCategory = bid.categoryName || bid.category || "Uncategorized";
              const lotImage = resolveImageUrl(bid.imageUrl || bid.image);

              // Calculate active time left using offerEndsAt or closesInHours
              const offerEndsAt = bid.offerEndsAt || bid.endTime || bid.closingDate;
              const timeLeft = getTimeRemaining(offerEndsAt, bid.closesInHours);

              return (
                <div
                  key={lotId}
                  className="tender-card tender-card-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => goToAsset(lotId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToAsset(lotId);
                    }
                  }}
                >
                  <div className="tender-image-wrapper">
                    {lotImage ? (
                      <img src={lotImage} alt={lotTitle} className="tender-image" />
                    ) : (
                      <div className="tender-image-fallback">No Image Available</div>
                    )}
                    <span className="tender-badge">{lotCategory}</span>
                  </div>

                  <div className="tender-content">
                    <h2 className="tender-title">{lotTitle}</h2>
                    <p className="tender-description">
                      Your offer: {formatRand(bid.myOfferAmount ?? bid.myBid)}
                    </p>

                    <div className="status-line">
                      <span className="status-dot status-dot-active" />
                      Status: Offer submitted
                    </div>

                    <div className="tender-footer">
                      <div className="adp-countdown">
                        <span className="adp-countdown-label">Time Remaining</span>
                        {timeLeft.expired ? (
                          <div className="adp-countdown-value">Closed</div>
                        ) : (
                          <div className="adp-countdown-value">
                            {timeLeft.days > 0 && (
                              <>
                                {String(timeLeft.days).padStart(2, "0")}
                                <sup>d</sup>{" "}
                              </>
                            )}
                            {String(timeLeft.hours).padStart(2, "0")}
                            <sup>h</sup> {String(timeLeft.minutes).padStart(2, "0")}
                            <sup>m</sup>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="tender-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToAsset(lotId);
                        }}
                      >
                        View Lot
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

export default MyActiveBidsPage;