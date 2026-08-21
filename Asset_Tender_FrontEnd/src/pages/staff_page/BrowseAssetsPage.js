import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PortalheaderS from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/staff_style/BrowseAssetsPage.css";
import "../../styles/shared/TenderCard.css";
import { getAllAssets } from "../../services/assetService.js";

const formatRand = (amount) =>
  `R\u00A0${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

function endTimeMs(tender) {
  const t = new Date(tender.endTime || tender.closingDate).getTime();
  return Number.isFinite(t) ? t : 0;
}

// --- ADDED: Helper to calculate remaining time ---
function calculateTimeLeft(tender) {
  const targetMs = endTimeMs(tender);
  if (!targetMs) return { days: 0, hours: 0, minutes: 0 };

  const diff = targetMs - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
  };
}

function sortTenders(rows, sortBy) {
  const sorted = [...rows];
  switch (sortBy) {
    case "closing-latest":
      sorted.sort((a, b) => endTimeMs(b) - endTimeMs(a));
      break;
    case "name-az":
      sorted.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), undefined, {
          sensitivity: "base",
        })
      );
      break;
    case "name-za":
      sorted.sort((a, b) =>
        String(b.title || "").localeCompare(String(a.title || ""), undefined, {
          sensitivity: "base",
        })
      );
      break;
    case "category-az":
      sorted.sort((a, b) => {
        const byCat = String(a.category || "").localeCompare(
          String(b.category || ""),
          undefined,
          { sensitivity: "base" }
        );
        if (byCat !== 0) return byCat;
        return String(a.title || "").localeCompare(String(b.title || ""), undefined, {
          sensitivity: "base",
        });
      });
      break;
    case "closing-soonest":
    default:
      sorted.sort((a, b) => endTimeMs(a) - endTimeMs(b));
      break;
  }
  return sorted;
}

function BrowseAssetsPage() {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState([]);
  const [sortBy, setSortBy] = useState("closing-soonest");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [, setNow] = useState(Date.now());

  // --- ADDED: Real-time ticker updating countdown every second ---
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const sortedTenders = useMemo(
    () => sortTenders(tenders, sortBy),
    [tenders, sortBy]
  );

  const goToAsset = (id) => {
    navigate(`/asset/${id}`);
  };

  return (
    <div className="browse-page-container">
      <PortalheaderS>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search assets..." />
        </div>
      </PortalheaderS>

      <main className="portal-content">
        <div className="content-heading-row">
          <h1>All Asset Tenders</h1>
          <div className="sort-container">
            <label htmlFor="sort-select">Sort by:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="closing-soonest">Closing Date (Soonest)</option>
              <option value="closing-latest">Closing Date (Latest)</option>
              <option value="name-az">Asset Name (A–Z)</option>
              <option value="name-za">Asset Name (Z–A)</option>
              <option value="category-az">Category (A–Z)</option>
            </select>
          </div>
        </div>

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

        {!loading && !loadError && sortedTenders.length > 0 && (
          <div className="tender-grid">
            {sortedTenders.map((tender) => {
              // --- ADDED: Calculate remaining time for this tender ---
              const timeLeft = calculateTimeLeft(tender);

              return (
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

                    {/* --- ADDED: Inline status line with time remaining --- */}
                    <div className="status-countdown-row">
                      <div className="status-line">
                        <span
                          className={`status-dot ${
                            tender.statusClass === "status-urgent"
                              ? "status-dot-urgent"
                              : "status-dot-active"
                          }`}
                        />
                        <span>Status: {tender.statusClass === "status-urgent" ? tender.status : "Live"}</span>
                      </div>

                      <span className="status-divider">•</span>

                      <div className="adp-countdown-inline">
                        <span className="adp-countdown-label-inline">Time Left:</span>
                        <span className="adp-countdown-value-inline">
                          {String(timeLeft.days).padStart(2, "0")}<sup>d</sup>{" "}
                          {String(timeLeft.hours).padStart(2, "0")}<sup>h</sup>{" "}
                          {String(timeLeft.minutes).padStart(2, "0")}<sup>m</sup>
                        </span>
                      </div>
                    </div>
                    {/* ---------------------------------------------------- */}

                    <div className="tender-price-container">
                      <p className="tender-label">
                        {tender.hasSubmittedOffer ? "Your Offer" : "Starting Bid"}
                      </p>
                      <p className="tender-price">
                        {formatRand(
                          tender.hasSubmittedOffer
                            ? tender.myOfferAmount
                            : tender.startingBid
                        )}
                      </p>
                    </div>

                    <div className="tender-footer">
                      <button
                        type="button"
                        className="tender-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToAsset(tender.id);
                        }}
                      >
                        {tender.hasSubmittedOffer
                          ? "View offer"
                          : "View and place offer"}
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

export default BrowseAssetsPage;