import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import "../../styles/staff_style/AssetDetailPage.css";
import { getAssetById } from "../../services/assetService.js";

function getTimeRemaining(endsAt) {
  const total = Math.max(0, endsAt.getTime() - Date.now());
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  return { total, days, hours, minutes };
}

function AssetDetailPage() {
  // 🔑 This is the piece that was missing: read the lot id straight out of
  // the URL (/asset/:id) so this page can act as a blueprint that fills in
  // the correct data per lot, instead of always showing the same asset.
  const { id } = useParams();
  const asset = useMemo(() => getAssetById(id), [id]);

  // The auction end time is derived once per asset (not on every render),
  // so the countdown doesn't jump around as the user types their bid.
  const auctionEndsAt = useMemo(() => {
    if (!asset) return null;
    return new Date(Date.now() + asset.auctionEndsInHours * 60 * 60 * 1000);
  }, [asset]);

  const [timeLeft, setTimeLeft] = useState(() =>
    auctionEndsAt ? getTimeRemaining(auctionEndsAt) : { days: 0, hours: 0, minutes: 0 }
  );
  const [bidAmount, setBidAmount] = useState("");
  const [feedback, setFeedback] = useState(null);

  // Reset the bid input and countdown whenever the visitor navigates to a
  // different lot (id changes), so leftover state from the previous asset
  // never leaks into the new one.
  useEffect(() => {
    if (!asset || !auctionEndsAt) return;
    setBidAmount(String(asset.recommendedBid - 500));
    setFeedback(null);
    setTimeLeft(getTimeRemaining(auctionEndsAt));
  }, [asset, auctionEndsAt]);

  useEffect(() => {
    if (!auctionEndsAt) return;
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(auctionEndsAt));
    }, 1000 * 30);
    return () => clearInterval(timer);
  }, [auctionEndsAt]);

  if (!asset) {
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
              We couldn't find a tender matching that ID. It may have closed or been removed.
            </p>
            <Link to="/browse" className="adp-place-bid-btn" style={{ display: "inline-block", marginTop: "12px" }}>
              Back to Browse Tenders
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const numericBid = Number(bidAmount.replace(/[^0-9.]/g, ""));
  const isBelowRecommended = numericBid > 0 && numericBid < asset.recommendedBid;

  const handleBidChange = (e) => {
    setBidAmount(e.target.value);
    setFeedback(null);
  };

  const handlePlaceBid = () => {
    if (!numericBid || numericBid <= 0) {
      setFeedback({ type: "error", message: "Enter a valid bid amount." });
      return;
    }
    if (isBelowRecommended) {
      setFeedback({
        type: "error",
        message: `Your bid must meet or exceed the recommended bid of R${asset.recommendedBid.toLocaleString()}.00.`,
      });
      return;
    }
    console.log("Placing bid:", numericBid, "on asset", asset.id);
    setFeedback({ type: "success", message: "Your bid has been placed." });
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
              Live Auction
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
            <span className="adp-meta-label">Recommended Bid</span>
            <span className="adp-recommended-value">
              R {asset.recommendedBid.toLocaleString()}.00
            </span>
          </div>

          <div className="adp-bid-input-block">
            <label htmlFor="bidAmount" className="adp-meta-label">
              Your Bid Amount (ZAR)
            </label>
            <div className={`adp-currency-input${isBelowRecommended ? " adp-currency-input-warning" : ""}`}>
              <span>R</span>
              <input
                id="bidAmount"
                type="text"
                inputMode="decimal"
                value={bidAmount}
                onChange={handleBidChange}
              />
            </div>
            <span className="adp-bid-hint">
              Your bid is the final price inclusive of VAT.
            </span>
          </div>

          {feedback && (
            <span className={`adp-feedback adp-feedback-${feedback.type}`}>
              {feedback.message}
            </span>
          )}

          <button className="adp-place-bid-btn" onClick={handlePlaceBid}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Place Bid
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