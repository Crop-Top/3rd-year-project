import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";
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

  // Sends the user to the blueprint detail page for this specific lot.
  const goToAsset = (id) => {
    navigate(`/asset/${id}`);
  };

  return (
    <div className="browse-page-container">
      {/* 1. Top Navigation Header */}
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

      {/* 2. Main Content Section */}
      <main className="portal-content">
        {/* Heading & Sorting UI Row */}
        <div className="content-heading-row">
          <h1>All Asset Tenders</h1>
          <div className="sort-container">
            <label htmlFor="sort-select">Sort by:</label>
            <select id="sort-select" defaultValue="closing-soonest">
              <option value="closing-soonest">Closing Date (Soonest)</option>
            </select>
          </div>
        </div>

        {/* 3. Tenders — same tender-grid / tender-card structure AdminPage
            uses, styled from the shared TenderCard.css, so staff and admin
            tiles are guaranteed to look and size identically. */}
        {loading && <div className="tender-loading">Loading live tenders...</div>}
        {loadError && (
          <div className="tender-empty">
            <p style={{ color: "#b91c1c" }}>{loadError}</p>
          </div>
        )}
        {!loading && !loadError && tenders.length === 0 && (
          <div className="tender-empty">
            <p>No live asset tenders are available yet.</p>
          </div>
        )}

        {!loading && !loadError && tenders.length > 0 && (
          <div className="tender-grid">
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
                <div className="tender-image-wrapper">
                  {tender.image ? (
                    <img src={tender.image} alt={tender.title} className="tender-image" />
                  ) : (
                    <div className="tender-image-fallback">No Image Available</div>
                  )}
                  <span className="tender-badge">{tender.category}</span>
                </div>

                <div className="tender-content">
                  <h2 className="tender-title">{tender.title}</h2>
                  <p className="tender-description">{tender.description}</p>

                  {tender.status && (
                    <div className="status-line">
                      <span
                        className={`status-dot ${
                          tender.statusClass === "status-urgent" ? "status-dot-urgent" : "status-dot-active"
                        }`}
                      />
                      Status: {tender.statusClass === "status-urgent" ? tender.status : "Live"}
                    </div>
                  )}

                  <div className="tender-footer">
                    <div>
                      <p className="tender-label">Leading Bid</p>
                      <p className="tender-price">{formatRand(tender.leadingBid)}</p>
                    </div>
                    <button
                      type="button"
                      className="tender-btn"
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
        )}

        {/* 4. Pagination */}
        <div className="pagination">
          <button className="page-nav-btn">{"<"}</button>
          <button className="page-num-btn active">1</button>
          <button className="page-num-btn">2</button>
          <button className="page-num-btn">3</button>
          <button className="page-nav-btn">{">"}</button>
        </div>
      </main>

      {/* 5. System Global Base Footer Block */}
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