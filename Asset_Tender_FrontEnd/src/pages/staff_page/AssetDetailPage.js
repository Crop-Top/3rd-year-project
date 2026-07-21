import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../../styles/staff_style/AssetDetailPage.css";

const ASSET = {
  id: "8472-A",
  barcode: "NMU-SCI-8472-A",
  title: "Olympus BX53 Biological Microscope",
  description:
    "High-grade research microscope previously utilized by the Faculty of Health Sciences. Fully operational with minor cosmetic wear. Calibrated last in Q3 2023. Includes standard objective lenses (10x, 40x, 100x) and power supply.",
  department: "Health Sciences",
  conditionGrade: "Grade A - Excellent",
  category: "Laboratory Equipment",
  image:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
  recommendedBid: 14500,
  auctionEndsAt: new Date(Date.now() + (2 * 24 + 14) * 60 * 60 * 1000 + 35 * 60 * 1000),
};

function getTimeRemaining(endsAt) {
  const total = Math.max(0, endsAt.getTime() - Date.now());
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  return { total, days, hours, minutes };
}

function AssetDetailPage() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(ASSET.auctionEndsAt));
  const [bidAmount, setBidAmount] = useState("14000");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(ASSET.auctionEndsAt));
    }, 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  const numericBid = Number(bidAmount.replace(/[^0-9.]/g, ""));
  const isBelowRecommended = numericBid > 0 && numericBid < ASSET.recommendedBid;

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
        message: `Your bid must meet or exceed the recommended bid of R${ASSET.recommendedBid.toLocaleString()}.00.`,
      });
      return;
    }
    console.log("Placing bid:", numericBid, "on asset", ASSET.id);
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
        <Link to="/browse">{ASSET.category}</Link>
        <span>&gt;</span>
        <span className="adp-breadcrumb-current">Asset #{ASSET.id}</span>
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
            <img src={ASSET.image} alt={ASSET.title} className="adp-image" />
          </div>

          <div className="adp-details-card">
            <h1>{ASSET.title}</h1>
            <p className="adp-description">{ASSET.description}</p>

            <div className="adp-meta-grid">
              <div>
                <span className="adp-meta-label">Barcode/Serial</span>
                <span className="adp-meta-value">{ASSET.barcode}</span>
              </div>
              <div>
                <span className="adp-meta-label">Department of Origin</span>
                <span className="adp-meta-value">{ASSET.department}</span>
              </div>
              <div>
                <span className="adp-meta-label">Condition Grade</span>
                <span className="adp-condition-badge">{ASSET.conditionGrade}</span>
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
              R {ASSET.recommendedBid.toLocaleString()}.00
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