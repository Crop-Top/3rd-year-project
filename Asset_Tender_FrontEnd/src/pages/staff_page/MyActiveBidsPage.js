import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyActiveBids } from "../../services/assetService.js";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Skeleton Component to display loading animation state
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

  // Client-side search filtering supporting property fallbacks
  const filteredBids = bids.filter((bid) => {
    const title = bid.assetName || bid.title || "";
    const category = bid.categoryName || bid.category || "";
    const query = searchTerm.toLowerCase();
    return title.toLowerCase().includes(query) || category.toLowerCase().includes(query);
  });

  return (
    <div className="browse-page-container">
      <header className="portal-header">
        <div className="header-left">
          <div className="logo-placeholder">[Logo] Nelson Mandela University</div>
          <span className="portal-title">Asset Tender Portal</span>
        </div>
        <div className="header-right">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search your bids..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="portal-content">
        <div className="content-heading-row">
          <h1>My Active Bids</h1>
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
            <p>You haven't placed any active bids yet.</p>
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
              const lotImage = bid.imageUrl || bid.image;

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
                      Your bid: {formatRand(bid.myBid)} &middot; Leading bid: {formatRand(bid.leadingBid)}
                    </p>

                    <div className="status-line">
                      <span
                        className={`status-dot ${
                          bid.isWinning ? "status-dot-active" : "status-dot-urgent"
                        }`}
                      />
                      Status: {bid.isWinning ? "Winning" : "Outbid"}
                    </div>

                    <div className="tender-footer">
                      <div>
                        <p className="tender-label">Closes In</p>
                        <p className="tender-price">{bid.closesInHours ?? 0}h</p>
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

      <footer className="portal-footer">
        <h3>Asset Tender Portal</h3>
        <div className="footer-links">
          <a href="#terms">Terms of Use</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#faq">Tender FAQ</a>
          <a href="#accessibility">Accessibility</a>
          <a href="#contact">Contact Procurement</a>
        </div>
      </footer>
    </div>
  );
}

export default MyActiveBidsPage;