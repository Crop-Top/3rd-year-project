import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyActiveBids } from "../../services/assetService.js";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MyActiveBidsPage() {
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

  // Client-side search filtering
  const filteredBids = bids.filter((bid) =>
    bid.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bid.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {loading && <div className="tender-loading">Loading your active bids...</div>}
        
        {loadError && (
          <div className="tender-empty">
            <p style={{ color: "#b91c1c" }}>{loadError}</p>
          </div>
        )}

        {!loading && !loadError && bids.length === 0 && (
          <div className="tender-empty">
            <p>You haven't placed any active bids yet.</p>
          </div>
        )}

        {!loading && !loadError && bids.length > 0 && filteredBids.length === 0 && (
          <div className="tender-empty">
            <p>No active bids match your search query "{searchTerm}".</p>
          </div>
        )}

        {!loading && !loadError && filteredBids.length > 0 && (
          <div className="tender-grid">
            {filteredBids.map((bid) => (
              <div key={bid.id} className="tender-card">
                <div className="tender-image-wrapper">
                  {bid.image ? (
                    <img src={bid.image} alt={bid.title} className="tender-image" />
                  ) : (
                    <div className="tender-image-fallback">No Image Available</div>
                  )}
                  <span className="tender-badge">{bid.category}</span>
                </div>

                <div className="tender-content">
                  <h2 className="tender-title">{bid.title}</h2>
                  <p className="tender-description">
                    Your bid: {formatRand(bid.myBid)} &middot; Leading bid: {formatRand(bid.leadingBid)}
                  </p>

                  <div className="status-line">
                    <span className={`status-dot ${bid.isWinning ? "status-dot-active" : "status-dot-urgent"}`} />
                    Status: {bid.isWinning ? "Winning" : "Outbid"}
                  </div>

                  <div className="tender-footer">
                    <div>
                      <p className="tender-label">Closes In</p>
                      <p className="tender-price">{bid.closesInHours}h</p>
                    </div>
                    <Link to={`/asset/${bid.listingId}`} className="tender-btn">
                      View Lot
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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