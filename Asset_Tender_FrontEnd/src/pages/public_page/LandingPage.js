import React, { useState, useEffect, useRef } from "react";
import "../../styles/public_style/LandingPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { login, getCurrentUser, resendVerificationEmail } from "../../services/authService";
import { getFeaturedTenders } from "../../services/assetService";
import { Turnstile } from "@marsidev/react-turnstile";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatClosingBadge = (hoursLeft) => {
  if (hoursLeft == null || Number.isNaN(hoursLeft) || hoursLeft <= 0) return "CLOSED";
  if (hoursLeft < 24) return `CLOSES IN ${Math.max(1, Math.ceil(hoursLeft))}H`;
  return `CLOSES IN ${Math.ceil(hoursLeft / 24)}D`;
};

const LandingPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [featuredTenders, setFeaturedTenders] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState("");

  const [turnstileToken, setTurnstileToken] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const turnstileRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const [alertMessage, setAlertMessage] = useState("");
  const [unverifiedMessage, setUnverifiedMessage] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0);
  const [resendCooldownNow, setResendCooldownNow] = useState(Date.now());

  // Inject Google Cursive Font dynamically for the callout
  useEffect(() => {
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);

    return () => {
      document.head.removeChild(fontLink);
    };
  }, []);

  useEffect(() => {
    if (resendCooldownUntil <= Date.now()) return undefined;
    const id = setInterval(() => setResendCooldownNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendCooldownUntil]);

  const resendCooldownSeconds = Math.max(0, Math.ceil((resendCooldownUntil - resendCooldownNow) / 1000));
  const resendOnCooldown = resendCooldownSeconds > 0;

  const TURNSTILE_SITE_KEY = "0x4AAAAAAD7NmXvqqdvsYaeg";

  useEffect(() => {
    if (location.state && location.state.fromProtected) {
      setAlertMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeatured() {
      try {
        setFeaturedLoading(true);
        setFeaturedError("");
        const rows = await getFeaturedTenders(3);
        if (!cancelled) setFeaturedTenders(rows);
      } catch (err) {
        if (!cancelled) {
          setFeaturedError(err.message || "Failed to load featured tenders.");
          setFeaturedTenders([]);
        }
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }

    loadFeatured();
    return () => {
      cancelled = true;
    };
  }, []);

  const isBrowseEligible = (user) => {
    const role = (user?.role || "").toLowerCase();
    return role === "staff" || role === "bidder";
  };

  const handleViewAll = () => {
    const user = getCurrentUser();
    if (isBrowseEligible(user)) {
      navigate("/browse");
    } else {
      navigate("/");
      setAlertMessage("Please sign in to browse all live tenders.");
    }
  };

  const handlePlaceBid = (listingId) => {
    const user = getCurrentUser();
    if (isBrowseEligible(user)) {
      navigate(`/asset/${listingId}`);
    } else {
      navigate("/");
      setAlertMessage("Please sign in to place a bid.");
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();

    if (requiresCaptcha && !turnstileToken) {
      alert("Please complete the CAPTCHA verification before proceeding.");
      return;
    }

    try {
      const result = await login(username, password, turnstileToken);

      if (result.success) {
        const user = getCurrentUser() || result.data?.user;

        if (!user) {
          alert("⚠️ Login was successful, but user profile metadata could not be parsed.");
          return;
        }

        localStorage.setItem("user", JSON.stringify(user));

        setUsername("");
        setPassword("");
        setTurnstileToken("");
        setRequiresCaptcha(false);
        setUnverifiedMessage("");

        const normalizedRole = user.role?.toLowerCase();
        if (normalizedRole === "admin" || normalizedRole === "superadmin" || normalizedRole === "procurementadmin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/browse", { replace: true });
        }
        return;
      }

      const backendMessage = result.data?.message || result.message || "Invalid credentials. Please try again.";
      const statusType = result.data?.status || result.data?.Status;

      if (statusType === "EmailUnverified") {
        setUnverifiedMessage(backendMessage);
      } else if (statusType === "Pending") {
        setUnverifiedMessage("");
        alert(`Registration Pending\n\n${backendMessage}`);
      } else if (statusType === "Rejected") {
        setUnverifiedMessage("");
        alert(`Registration Declined\n\n${backendMessage}`);
      } else if (statusType === "Suspended") {
        setUnverifiedMessage("");
        alert(`Account Suspended\n\n${backendMessage}`);
      } else {
        setUnverifiedMessage("");
        alert(backendMessage);
      }

      if (result.data?.requiresCaptcha || result.data?.RequiresCaptcha) {
        setRequiresCaptcha(true);
      }

      setTurnstileToken("");
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    } catch (error) {
      console.error("Sign-in handling pipeline failed entirely:", error);
      alert("Unable to connect to the server. Please check your network connection.");
    }
  };

  const handleResendVerification = async () => {
    const email = username.trim();
    if (!email) {
      alert("Enter your email address in the username field, then click Resend.");
      return;
    }

    if (resendOnCooldown) return;

    setResendingVerification(true);
    try {
      const result = await resendVerificationEmail(email);
      setUnverifiedMessage(
        result.data?.message ||
          "If an unverified account exists for that email, a new verification link has been sent."
      );
      setResendCooldownUntil(Date.now() + 30000);
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className="portal-container">
      {alertMessage && (
        <div className="auth-alert-banner">
          <span>⚠️ {alertMessage}</span>
          <button className="close-alert-btn" onClick={() => setAlertMessage("")}>&times;</button>
        </div>
      )}

      {unverifiedMessage && (
        <div className="auth-alert-banner auth-alert-banner--unverified">
          <div className="auth-alert-banner-content">
            <span>Email not verified — {unverifiedMessage}</span>
            <button
              type="button"
              className="resend-verification-btn"
              onClick={handleResendVerification}
              disabled={resendingVerification || resendOnCooldown}
            >
              {resendingVerification
                ? "Sending…"
                : resendOnCooldown
                  ? `Resend available in ${resendCooldownSeconds}s`
                  : "Resend verification email"}
            </button>
          </div>
          <button className="close-alert-btn" onClick={() => setUnverifiedMessage("")}>&times;</button>
        </div>
      )}

      <header className="portal-header">
        <div className="header-left">
          <div className="logo-placeholder">
            <span className="logo-bold">NELSON MANDELA</span>
            <span className="logo-light">UNIVERSITY</span>
          </div>
          <div className="divider-vertical"></div>
          <span className="portal-brand-title">Asset Tender Portal</span>
        </div>

        <form className="header-login-form" onSubmit={handleSignIn}>
          <div className="login-inputs-group">
            <span className="staff-login-label">Staff login</span>

            <div className="login-fields-row">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                required
              />
              <button type="submit" className="btn-signin"> Sign In </button>
            </div>

            <button
              type="button"
              className="forgot-password-link"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </button>
          </div>

          {requiresCaptcha && (
            <div className="turnstile-wrapper" style={{ marginTop: "10px" }}>
              <span style={{ fontSize: "0.8rem", color: "#d9534f", display: "block", marginBottom: "4px" }}>
                Security check required due to failed attempts:
              </span>
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken("")}
                onError={(err) => console.error("[DEBUG] Turnstile Error:", err)}
              />
            </div>
          )}
        </form>
      </header>

      <section className="hero-banner">
        <div className="hero-content-left">
          <p className="hero-description">
            Welcome to the official Asset Tender Portal. Discover and bid on surplus university assets, equipment, and vehicles. Secure, transparent, and open to the public.
          </p>

          {/* EXTERNAL REGISTRATION BUTTON WITH FULL LOOP SWIRL POINTING DOWN */}
          <div className="hero-button-callout-wrapper">
            <div className="hero-swirl-pointer">
              <span className="hero-cursive-text">Register!</span>
              <svg className="hero-swirl-arrow" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Full 360-degree loop-de-loop extending vertically down */}
                <path 
                  d="M 10 15 C 45 -15, 85 10, 80 40 C 75 70, 30 70, 30 40 C 30 15, 75 20, 55 90" 
                  stroke="#ffe099" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  fill="none" 
                />
                {/* Arrowhead pointing straight down at (55, 90) */}
                <path 
                  d="M 45 78 L 55 92 L 65 78" 
                  stroke="#ffe099" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none" 
                />
              </svg>
            </div>

            <button
              className="btn-external-reg"
              onClick={() => navigate("/register")}
            >
              External tender registration
            </button>
          </div>
        </div>
        <div className="hero-content-right">
          <h1 className="hero-large-title">Asset Tender<br />Portal</h1>
        </div>
      </section>

      <main className="main-content">
        <div className="section-header-row">
          <div>
            <h2 className="section-main-title">Featured Active Tenders</h2>
            <p className="section-subtitle">High-value assets closing soon.</p>
          </div>
          <button className="btn-view-all" onClick={handleViewAll}>
            View All &rarr;
          </button>
        </div>

        {featuredLoading && <p>Loading featured tenders...</p>}
        {featuredError && <p style={{ color: "#b91c1c" }}>{featuredError}</p>}
        {!featuredLoading && !featuredError && featuredTenders.length === 0 && (
          <p>No live asset tenders are available yet.</p>
        )}

        <div className="tenders-grid">
          {featuredTenders.map((tender) => (
            <div
              key={tender.id}
              className="tender-card"
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onClick={() => handlePlaceBid(tender.listingId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePlaceBid(tender.listingId);
                }
              }}
            >
              <div className="card-image-wrapper">
                {tender.image ? (
                  <img src={tender.image} alt={tender.title} className="card-image" />
                ) : (
                  <div
                    className="card-image"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#e2e8f0",
                      color: "#64748b",
                    }}
                  >
                    No Image
                  </div>
                )}
                <span className="badge-closing">
                  <span className="dot-indicator"></span> {formatClosingBadge(tender.auctionEndsInHours)}
                </span>
              </div>

              <div className="card-body">
                <span className="card-category-badge">{tender.category}</span>
                <h3 className="card-lot-title">
                  <strong>Lot {tender.listingId}:</strong> {tender.title}
                </h3>
                <p className="card-description">{tender.description}</p>

                <div className="card-footer-row">
                  <div className="bid-box">
                    <span className="bid-label">STARTING BID</span>
                    <span className="bid-amount">{formatRand(tender.startingBid ?? tender.leadingBid)}</span>
                  </div>
                  <button
                    className="btn-place-bid"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaceBid(tender.listingId);
                    }}
                  >
                    PLACE BID
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="portal-footer">
        <h3 className="footer-brand">Asset Tender Portal</h3>
        <div className="footer-links">
          <span onClick={() => navigate("/terms")}>Terms of Use</span>
          <span onClick={() => navigate("/privacy")}>Privacy Policy</span>
          <span onClick={() => navigate("/faq")}>Tender FAQ</span>
          <span onClick={() => navigate("/accessibility")}>Accessibility</span>
          <span onClick={() => navigate("/contact")}>Contact Procurement</span>
        </div>
        <p className="footer-copyright">
          &copy; 2026 Nelson Mandela University. All Rights Reserved. Asset Disposal & Tender Division.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;