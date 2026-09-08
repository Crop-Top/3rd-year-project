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

// Sub-component for individual card countdown to avoid full-page re-renders
function TenderCountdown({ tender }) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(tender));

  function calculateTimeLeft(t) {
    const targetMs = endTimeMs(t);
    if (!targetMs) return { days: 0, hours: 0, minutes: 0 };
    const diff = targetMs - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(tender));
    }, 1000);
    return () => clearInterval(timer);
  }, [tender]);

  return (
    <span className="adp-countdown-value-inline">
      {String(timeLeft.days).padStart(2, "0")}<sup>d</sup>{" "}
      {String(timeLeft.hours).padStart(2, "0")}<sup>h</sup>{" "}
      {String(timeLeft.minutes).padStart(2, "0")}<sup>m</sup>
    </span>
  );
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
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("closing-soonest");
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

  // Filter by search query then apply sorting
  const processedTenders = useMemo(() => {
    const filtered = tenders.filter((t) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        String(t.title || "").toLowerCase().includes(term) ||
        String(t.category || "").toLowerCase().includes(term) ||
        String(t.description || "").toLowerCase().includes(term)
      );
    });

    return sortTenders(filtered, sortBy);
  }, [tenders, searchTerm, sortBy]);

  const goToAsset = (id) => {
    navigate(`/asset/${id}`);
  };

  return (
    <div className="browse-page-container">
      <PortalheaderS>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
        {!loading && !loadError && processedTenders.length === 0 && (
          <div className="tender-empty">
            <p>
              {searchTerm
                ? "No asset tenders matched your search."
                : "No live asset tenders are available yet."}
            </p>
          </div>
        )}

        {!loading && !loadError && processedTenders.length > 0 && (
          <div className="tender-grid">
            {processedTenders.map((tender) => {
              // Check if item category is Vehicle/Vehicles
              const cat = String(tender.category || "").trim().toLowerCase();
              const isVehicleCategory = cat === "vehicle" || cat === "vehicles";

              // Safely extract StartingBid / reserve price field
              const reservePrice =
                tender.startingBid ??
                tender.StartingBid ??
                tender.reservePrice ??
                tender.reserveAmount ??
                0;

              return (
                <article
                  key={tender.id}
                  className="tender-card tender-card-clickable"
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

                    <div className="status-countdown-row">
                      <div className="status-line">
                        <span
                          className={`status-dot ${
                            tender.statusClass === "status-urgent"
                              ? "status-dot-urgent"
                              : "status-dot-active"
                          }`}
                        />
                        <span>
                          Status: {tender.statusClass === "status-urgent" ? tender.status : "Live"}
                        </span>
                      </div>

                      <span className="status-divider">•</span>

                      <div className="adp-countdown-inline">
                        <span className="adp-countdown-label-inline">Time Left:</span>
                        <TenderCountdown tender={tender} />
                      </div>
                    </div>

                    {/* Displays Reserve Price specifically for Vehicle category */}
                    {isVehicleCategory && (
                      <div className="tender-price-container" style={{ marginBottom: tender.hasSubmittedOffer ? "8px" : "0" }}>
                        <p className="tender-label">Reserve Price</p>
                        <p className="tender-price" style={{ color: "#0f172a", fontWeight: "600" }}>
                          {formatRand(reservePrice)}
                        </p>
                      </div>
                    )}

                    {/* Displays ONLY user's submitted offer */}
                    {tender.hasSubmittedOffer && (
                      <div className="tender-price-container">
                        <p className="tender-label">Your Submitted Offer</p>
                        <p className="tender-price">
                          {formatRand(tender.myOfferAmount)}
                        </p>
                      </div>
                    )}

                    <div className="tender-footer">
                      <span className="tender-btn">
                        {tender.hasSubmittedOffer
                          ? "View My Offer"
                          : "View and Submit Offer"}
                      </span>
                    </div>
                  </div>
                </article>
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