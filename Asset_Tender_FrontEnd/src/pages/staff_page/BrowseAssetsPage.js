import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/staff_style/BrowseAssetsPage.css";
import { getAllAssets } from "../../services/assetService.js";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function BrowseAssetsPage() {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTenders() {
      try {
        setLoading(true);
        setLoadError("");
        const rows = await getAllAssets();
        if (!cancelled) setTenders(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load tenders.");
          setTenders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTenders();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToAsset = (id) => {
    navigate(`/asset/${id}`);
  };

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
            <input type="text" placeholder="Search assets..." />
          </div>
        </div>
      </header>

      <main className="portal-content">
        <div className="content-heading-row">
          <h1>All Asset Tenders</h1>
          <div className="sort-container">
            <label htmlFor="sort-select">Sort by:</label>
            <select id="sort-select" defaultValue="closing-soonest">
              <option value="closing-soonest">Closing Date (Soonest)</option>
            </select>
          </div>
        </div>

        {loading && <p>Loading approved tenders...</p>}
        {loadError && <p style={{ color: "#b91c1c" }}>{loadError}</p>}
        {!loading && !loadError && tenders.length === 0 && (
          <p>No live asset tenders are available yet.</p>
        )}
        <div className="tenders-list">
          {tenders.map((tender) => (
            <div
              key={tender.id}
              className="tender-card tender-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => goToAsset(tender.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") goToAsset(tender.id);
              }}
            >
              <div className="tender-image-placeholder">
                <span className={`status-badge ${tender.statusClass}`}>● {tender.status}</span>
                {tender.image ? (
                  <img src={tender.image} alt={tender.title} className="tender-image" />
                ) : (
                  <div className="image-mock-text">No Image Available</div>
                )}
              </div>

              <div className="tender-details">
                <span className="tender-category">{tender.category}</span>
                <h2 className="tender-title">{tender.title}</h2>
                <p className="tender-description">{tender.description}</p>

                <div className="tender-footer-row">
                  <div className="bid-info">
                    <span className="bid-label">Leading Bid</span>
                    <span className="bid-amount">{formatRand(tender.leadingBid)}</span>
                  </div>
                  <button
                    type="button"
                    className="place-bid-btn btn-dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToAsset(tender.id);
                    }}
                  >
                    Place Bid
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pagination">
          <button className="page-nav-btn">{"<"}</button>
          <button className="page-num-btn active">1</button>
          <button className="page-num-btn">2</button>
          <button className="page-num-btn">3</button>
          <button className="page-nav-btn">{">"}</button>
        </div>
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

export default BrowseAssetsPage;
