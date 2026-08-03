import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import "../../styles/staff_style/AssetDetailPage.css";
import { getAssetById } from "../../services/assetService.js";
import { getBidsForListing, placeBid } from "../../services/bidService.js";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getTimeRemaining(endsAt) {
  const total = Math.max(0, endsAt.getTime() - Date.now());
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  return { total, days, hours, minutes };
}

function AssetDetailPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, total: 0 });

  const reload = async () => {
    const row = await getAssetById(id);
    setAsset(row);
    try {
      const history = await getBidsForListing(row.listingId);
      setBids(history);
    } catch {
      setBids([]);
    }
    return row;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAsset() {
      try {
        setLoading(true);
        setLoadError("");
        const row = await getAssetById(id);
        if (cancelled) return;
        setAsset(row);
        try {
          const history = await getBidsForListing(row.listingId);
          if (!cancelled) setBids(history);
        } catch {
          if (!cancelled) setBids([]);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load tender.");
          setAsset(null);
          setBids([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAsset();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const auctionEndsAt = useMemo(() => {
    if (!asset?.endTime) return null;
    return new Date(asset.endTime);
  }, [asset]);

  const leadingBid = asset?.leadingBid ?? asset?.startingBid ?? 0;
  const minNextBid = bids.length > 0 ? Number(leadingBid) + 0.01 : Number(asset?.startingBid ?? 0);

  useEffect(() => {
    if (!asset || !auctionEndsAt) return;
    const suggested = Math.max(Number(asset.recommendedBid || 0), minNextBid);
    setBidAmount(String(suggested.toFixed(2)));
    setFeedback(null);
    setTimeLeft(getTimeRemaining(auctionEndsAt));
  }, [asset, auctionEndsAt, minNextBid]);

  useEffect(() => {
    if (!auctionEndsAt) return;
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(auctionEndsAt));
    }, 1000 * 30);
    return () => clearInterval(timer);
  }, [auctionEndsAt]);

  if (loading) {
    return (
      <div className="adp-page">
        <main className="adp-main" style={{ padding: "48px 0" }}>
          <p>Loading tender details...</p>
        </main>
      </div>
    );
  }

  if (loadError || !asset) {
    return (
      <div className="adp-page">
        <header className="adp-header">
          <div className="adp-logo">
            <span className="adp-logo-crest">NM</span>
            <span className="adp-logo-text">
              NELSON MANDELA
              <br />
              UNIVERSITY
            </span>
          </div>
          <span className="adp-title">Asset Tender Portal</span>
          <Link to="/browse" className="adp-home-btn" aria-label="Back to browse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
          </Link>
        </header>
        <main className="adp-main" style={{ padding: "48px 0" }}>
          <div className="adp-details-card">
            <h1>Lot not found</h1>
            <p className="adp-description">
              {loadError ||
                "We couldn't find a tender matching that ID. It may still be pending approval, closed, or removed."}
            </p>
            <Link to="/browse" className="adp-place-bid-btn" style={{ display: "inline-block", marginTop: "12px" }}>
              Back to Browse Tenders
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const numericBid = Number(String(bidAmount).replace(/[^0-9.]/g, ""));
  const isBelowMinimum = numericBid > 0 && numericBid < minNextBid;
  const auctionEnded = timeLeft.total <= 0;

  const handleBidChange = (e) => {
    setBidAmount(e.target.value);
    setFeedback(null);
  };

  const handlePlaceBid = async () => {
    if (auctionEnded) {
      setFeedback({ type: "error", message: "This auction has already ended." });
      return;
    }
    if (!numericBid || numericBid <= 0) {
      setFeedback({ type: "error", message: "Enter a valid bid amount." });
      return;
    }
    if (isBelowMinimum) {
      setFeedback({
        type: "error",
        message: `Your bid must be at least ${formatRand(minNextBid)}.`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await placeBid(asset.listingId, numericBid);
      setFeedback({ type: "success", message: result.message || "Your bid has been placed." });
      const refreshed = await reload();
      const nextMin = Number(refreshed.leadingBid || 0) + 0.01;
      setBidAmount(String(Math.max(Number(refreshed.recommendedBid || 0), nextMin).toFixed(2)));
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to place bid." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="adp-page">
      <header className="adp-header">
        <div className="adp-logo">
          <span className="adp-logo-crest">NM</span>
          <span className="adp-logo-text">
            NELSON MANDELA
            <br />
            UNIVERSITY
          </span>
        </div>
        <span className="adp-title">Asset Tender Portal</span>
        <Link to="/browse" className="adp-home-btn" aria-label="Back to browse">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
        </Link>
      </header>

      <nav className="adp-breadcrumb">
        <Link to="/browse">Current Tenders</Link>
        <span>&gt;</span>
        <Link to="/browse">{asset.category}</Link>
        <span>&gt;</span>
        <span className="adp-breadcrumb-current">Asset #{asset.id}</span>
      </nav>

      <main className="adp-main">
        <div className="adp-left">
          <div className="adp-image-wrapper">
            <span className="adp-live-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {auctionEnded ? "Auction Ended" : "Live Auction"}
            </span>
            {asset.image ? (
              <img src={asset.image} alt={asset.title} className="adp-image" />
            ) : (
              <div className="adp-image adp-image-placeholder">No Image Available</div>
            )}
          </div>

          <div className="adp-details-card">
            <h1>{asset.title}</h1>
            <p className="adp-description">{asset.description}</p>

            <div className="adp-meta-grid">
              <div>
                <span className="adp-meta-label">Barcode/Serial</span>
                <span className="adp-meta-value">{asset.barcode}</span>
              </div>
              <div>
                <span className="adp-meta-label">Department of Origin</span>
                <span className="adp-meta-value">{asset.department}</span>
              </div>
              <div>
                <span className="adp-meta-label">Condition Grade</span>
                <span className="adp-condition-badge">{asset.conditionGrade}</span>
              </div>
            </div>

            <div className="adp-bid-history" style={{ marginTop: "24px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Bid History</h2>
              {bids.length === 0 ? (
                <p className="adp-description">No bids yet. Be the first to bid.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {bids.map((bid) => (
                    <li
                      key={bid.bidId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "10px 0",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span>
                        {bid.bidderDisplayName}
                        {bid.isLeading ? " (leading)" : ""}
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatRand(bid.bidAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <aside className="adp-bid-card">
          <div className="adp-countdown">
            <span className="adp-countdown-label">Time Remaining</span>
            <div className="adp-countdown-value">
              {String(timeLeft.days).padStart(2, "0")}
              <sup>d</sup> {String(timeLeft.hours).padStart(2, "0")}
              <sup>h</sup> {String(timeLeft.minutes).padStart(2, "0")}
              <sup>m</sup>
            </div>
          </div>

          <div className="adp-recommended">
            <span className="adp-meta-label">Leading Bid</span>
            <span className="adp-recommended-value">{formatRand(leadingBid)}</span>
          </div>

          <div className="adp-recommended" style={{ marginTop: "8px" }}>
            <span className="adp-meta-label">Recommended Bid</span>
            <span className="adp-recommended-value" style={{ fontSize: "1.1rem" }}>
              {formatRand(asset.recommendedBid)}
            </span>
          </div>

          <div className="adp-bid-input-block">
            <label htmlFor="bidAmount" className="adp-meta-label">
              Your Bid Amount (ZAR)
            </label>
            <div className={`adp-currency-input${isBelowMinimum ? " adp-currency-input-warning" : ""}`}>
              <span>R</span>
              <input
                id="bidAmount"
                type="text"
                inputMode="decimal"
                value={bidAmount}
                onChange={handleBidChange}
                disabled={auctionEnded || submitting}
              />
            </div>
            <span className="adp-bid-hint">
              Minimum next bid: {formatRand(minNextBid)}. Bids are final and inclusive of VAT.
            </span>
          </div>

          {feedback && (
            <span className={`adp-feedback adp-feedback-${feedback.type}`}>
              {feedback.message}
            </span>
          )}

          <button
            className="adp-place-bid-btn"
            onClick={handlePlaceBid}
            disabled={auctionEnded || submitting}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {submitting ? "Placing Bid..." : auctionEnded ? "Auction Closed" : "Place Bid"}
          </button>
        </aside>
      </main>

      <footer className="adp-footer">
        <span className="adp-footer-title">Asset Tender Portal</span>
        <nav className="adp-footer-links">
          <a href="/terms">Terms of Use</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/faq">Tender FAQ</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/contact">Contact Procurement</a>
        </nav>
        <p className="adp-footer-copy">
          &copy; 2024 Nelson Mandela University. All Rights Reserved. Asset
          Disposal &amp; Tender Division.
        </p>
      </footer>
    </div>
  );
}

export default AssetDetailPage;
