import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import "../../styles/staff_style/AssetDetailPage.css";
import { getAssetById } from "../../services/assetService.js";
import { placeBid } from "../../services/bidService.js";

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, total: 0 });

  const reload = async () => {
    const row = await getAssetById(id);
    setAsset(row);
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
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load tender.");
          setAsset(null);
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

  const offerEndsAt = useMemo(() => {
    if (!asset?.endTime) return null;
    return new Date(asset.endTime);
  }, [asset]);

  const startingBid = Number(asset?.startingBid ?? 0);
  const hasSubmittedOffer = Boolean(asset?.hasSubmittedOffer);

  useEffect(() => {
    if (!asset || !offerEndsAt) return;
    if (hasSubmittedOffer && asset.myOfferAmount != null) {
      setBidAmount(String(Number(asset.myOfferAmount).toFixed(2)));
    } else {
      const recommended = Number(asset.recommendedBid || 0);
      const suggested = recommended > 0 ? recommended : startingBid;
      setBidAmount(String(suggested.toFixed(2)));
    }
    setFeedback(null);
    setTimeLeft(getTimeRemaining(offerEndsAt));
  }, [asset, offerEndsAt, startingBid, hasSubmittedOffer]);

  useEffect(() => {
    if (!offerEndsAt) return;
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(offerEndsAt));
    }, 1000 * 30);
    return () => clearInterval(timer);
  }, [offerEndsAt]);

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
  const offerClosed = timeLeft.total <= 0;
  const formLocked = offerClosed || hasSubmittedOffer || submitting;

  const handleBidChange = (e) => {
    setBidAmount(e.target.value);
    setFeedback(null);
  };

  const handlePlaceOffer = async () => {
    if (offerClosed) {
      setFeedback({ type: "error", message: "This tender has already closed." });
      return;
    }
    if (hasSubmittedOffer) {
      setFeedback({ type: "error", message: "You have already submitted an offer on this lot." });
      return;
    }
    if (!numericBid || numericBid <= 0) {
      setFeedback({ type: "error", message: "Enter a valid offer amount." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await placeBid(asset.listingId, numericBid);
      setFeedback({
        type: "success",
        message: result.message || "Your offer has been submitted. You cannot change it.",
      });
      await reload();
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to submit offer." });
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
              {offerClosed ? "Tender Closed" : hasSubmittedOffer ? "Offer Submitted" : "Open for Offers"}
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
            <span className="adp-meta-label">Starting Bid</span>
            <span className="adp-recommended-value">{formatRand(startingBid)}</span>
          </div>

          {hasSubmittedOffer && (
            <div className="adp-recommended" style={{ marginTop: "8px" }}>
              <span className="adp-meta-label">Your Offer</span>
              <span className="adp-recommended-value" style={{ fontSize: "1.1rem" }}>
                {formatRand(asset.myOfferAmount)}
              </span>
            </div>
          )}

          <div className="adp-recommended" style={{ marginTop: "8px" }}>
            <span className="adp-meta-label">Recommended Offer</span>
            <span className="adp-recommended-value" style={{ fontSize: "1.1rem" }}>
              {formatRand(asset.recommendedBid)}
            </span>
          </div>

          <div className="adp-bid-input-block">
            <label htmlFor="bidAmount" className="adp-meta-label">
              Your Offer Amount (ZAR)
            </label>
            <div className="adp-currency-input">
              <span>R</span>
              <input
                id="bidAmount"
                type="text"
                inputMode="decimal"
                value={bidAmount}
                onChange={handleBidChange}
                disabled={formLocked}
              />
            </div>
            <span className="adp-bid-hint">
              {hasSubmittedOffer
                ? "You have already submitted your one sealed offer for this lot."
                : "One offer only — sealed and final (inclusive of VAT)."}
            </span>
          </div>

          {feedback && (
            <span className={`adp-feedback adp-feedback-${feedback.type}`}>
              {feedback.message}
            </span>
          )}

          <button
            className="adp-place-bid-btn"
            onClick={handlePlaceOffer}
            disabled={formLocked}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {submitting
              ? "Submitting..."
              : offerClosed
                ? "Tender Closed"
                : hasSubmittedOffer
                  ? "Offer Submitted"
                  : "Submit Offer"}
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
