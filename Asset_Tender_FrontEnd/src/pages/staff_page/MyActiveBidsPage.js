import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";

// TODO: replace this mock with a real API call once the backend exposes an
// endpoint for the logged-in user's bids, e.g.
// import { getMyActiveBids } from "../../services/assetService.js";
const MOCK_MY_BIDS = [
  {
    id: "1",
    listingId: "1",
    title: "2019 Toyota Corolla 1.6 Quest",
    category: "VEHICLES - SEDANS",
    description: "Ex-fleet vehicle in good condition. Full service history available.",
    myBid: 84000,
    leadingBid: 85000,
    isWinning: false,
    closesInHours: 48,
    image: null,
  },
  {
    id: "2",
    listingId: "2",
    title: "Olympus CX23 Upright Microscope",
    category: "SCIENTIFIC",
    description: "Binocular microscope used in undergraduate biology labs.",
    myBid: 14500,
    leadingBid: 14500,
    isWinning: true,
    closesInHours: 62,
    image: null,
  },
  {
    id: "4",
    listingId: "4",
    title: "2018 Isuzu D-Max 250 Single Cab",
    category: "VEHICLES - UTILITY",
    description: "Campus maintenance vehicle. Canopy included.",
    myBid: 110000,
    leadingBid: 115000,
    isWinning: false,
    closesInHours: 96,
    image: null,
  },
];

async function fetchMyActiveBidsMock() {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_MY_BIDS), 200));
}

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MyActiveBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBids() {
      try {
        setLoading(true);
        setLoadError("");
        const rows = await fetchMyActiveBidsMock();
        if (!cancelled) setBids(rows);
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

  return (
    <div className="browse-page-container">
      {/* Same header shell as BrowseAssetsPage, for a consistent staff shell */}
      <header className="portal-header">
        <div className="header-left">
          <div className="logo-placeholder">[Logo] Nelson Mandela University</div>
          <span className="portal-title">Asset Tender Portal</span>
        </div>
        <div className="header-right">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search your bids..." />
          </div>
        </div>
      </header>

      <main className="portal-content">
        <div className="content-heading-row">
          <h1>My Active Bids</h1>
        </div>

        {loading && <div className="tender-loading">Loading your bids...</div>}
        {loadError && (
          <div className="tender-empty">
            <p style={{ color: "#b91c1c" }}>{loadError}</p>
          </div>
        )}
        {!loading && !loadError && bids.length === 0 && (
          <div className="tender-empty">
            <p>You haven't placed any bids yet.</p>
          </div>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="tender-grid">
            {bids.map((bid) => (
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