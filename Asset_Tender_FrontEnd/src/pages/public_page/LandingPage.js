import React, { useState, useEffect, useRef } from "react";
import "../../styles/public_style/LandingPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { login, getCurrentUser } from "../../services/authService";
import { Turnstile } from "@marsidev/react-turnstile";

const LandingPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // CAPTCHA State Management
  const [turnstileToken, setTurnstileToken] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const turnstileRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const [alertMessage, setAlertMessage] = useState("");

  const API_BASE = process.env.REACT_APP_API_BASE || "";
  const USER_API = process.env.REACT_APP_USER_API || "";
  
  // TIP: Use '3x00000000000000000000FF' for interactive testing widget during local dev
  const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || "3x00000000000000000000FF";

  useEffect(() => {
    if (location.state && location.state.fromProtected) {
      setAlertMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}${USER_API}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Fetch Error:", err);
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const featuredTenders = [
    {
      id: "lot-402",
      lotNumber: "Lot 402",
      title: "Advanced Spectrophotometer",
      category: "SCIENTIFIC",
      description: "Decommissioned research equipment from the Department of Chemistry. Fully functional.",
      currentBid: "R 45,000",
      closingTime: "CLOSES IN 2H",
      image: "https://via.placeholder.com/400x250?text=Spectrophotometer"
    },
    {
      id: "lot-115",
      lotNumber: "Lot 115",
      title: "2018 Toyota Quantum Minibus",
      category: "VEHICLES",
      description: "University fleet vehicle. 140,000km. Full service history available in tender documents.",
      currentBid: "R 185,000",
      closingTime: "CLOSES IN 1D",
      image: "https://via.placeholder.com/400x250?text=Toyota+Quantum"
    },
    {
      id: "lot-089",
      lotNumber: "Lot 089",
      title: "Bulk Office Ergo Chairs (x50)",
      category: "FURNITURE",
      description: "Lot of 50 ergonomic office chairs in excellent condition from the library refurbishment.",
      currentBid: "R 12,500",
      closingTime: "CLOSES IN 3D",
      image: "https://via.placeholder.com/400x250?text=Ergo+Chairs"
    }
  ];

  const handleSignIn = async (e) => {
    e.preventDefault();

    console.log("[DEBUG handleSignIn] Current username:", username);
    console.log("[DEBUG handleSignIn] Current requiresCaptcha:", requiresCaptcha);
    console.log("[DEBUG handleSignIn] Current turnstileToken:", turnstileToken);

    // Prevent submission if backend requires CAPTCHA but user hasn't completed it
    if (requiresCaptcha && !turnstileToken) {
      alert("Please complete the CAPTCHA verification before proceeding.");
      return;
    }

    const tokenToSend = turnstileToken;

    try {
      console.log("[DEBUG handleSignIn] Sending token to login():", tokenToSend);
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

        const normalizedRole = user.role?.toLowerCase();
        if (normalizedRole === "admin" || normalizedRole === "procurementadmin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/browse", { replace: true });
        }
      } else {
        // Backend indicated login failure
        const backendMessage = result.data?.message || "Invalid credentials. Please try again.";
        alert(backendMessage);

        // Turn on CAPTCHA if backend asks for it
        if (result.data?.requiresCaptcha) {
          setRequiresCaptcha(true);
        }

        // Reset the turnstile token state and widget on failed attempt
        setTurnstileToken("");
        if (turnstileRef.current) {
          turnstileRef.current.reset();
        }
      }
    } catch (error) {
      console.error("Sign-in handling pipeline failed entirely:", error);
      alert("Unable to connect to the server.");
    }
  };

  return (
    <div className="portal-container">
      {/* AUTHENTICATION ALERT BANNER */}
      {alertMessage && (
        <div className="auth-alert-banner">
          <span>⚠️ {alertMessage}</span>
          <button className="close-alert-btn" onClick={() => setAlertMessage("")}>&times;</button>
        </div>
      )}

      {/* 1. TOP HEADER / NAVIGATION */}
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
            <button type="submit" className="btn-signin">Sign In</button>
          </div>

          {/* Conditional Turnstile Widget Rendering */}
          {requiresCaptcha && (
            <div className="turnstile-wrapper" style={{ marginTop: "10px" }}>
              <span style={{ fontSize: "0.8rem", color: "#d9534f", display: "block", marginBottom: "4px" }}>
                Security check required due to failed attempts:
              </span>
              <Turnstile 
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY} 
                onSuccess={(token) => {
                  console.log("[DEBUG] Turnstile Token Captured:", token);
                  setTurnstileToken(token);
                }}
                onVerify={(token) => {
                  console.log("[DEBUG] Turnstile Token Captured (Verify):", token);
                  setTurnstileToken(token);
                }}
                onExpire={() => setTurnstileToken("")}
                onError={(err) => console.error("[DEBUG] Turnstile Error:", err)}
              />
            </div>
          )}
        </form>
      </header>

      {/* 2. HERO BANNER SECTION */}
      <section className="hero-banner">
        <div className="hero-content-left">
          <p className="hero-description">
            Welcome to the official Asset Tender Portal. Discover and bid on surplus university assets, equipment, and vehicles. Secure, transparent, and open to the public.
          </p>
          <button 
            className="btn-external-reg" 
            onClick={() => navigate("/register")}
          >
            External tender registration
          </button>
        </div>
        <div className="hero-content-right">
          <h1 className="hero-large-title">Asset Tender<br />Portal</h1>
        </div>
      </section>

      {/* 3. FEATURED ACTIVE TENDERS SECTION */}
      <main className="main-content">
        <div className="section-header-row">
          <div>
            <h2 className="section-main-title">Featured Active Tenders</h2>
            <p className="section-subtitle">High-value assets closing soon.</p>
          </div>
          <button className="btn-view-all" onClick={() => navigate("/tenders")}>
            View All &rarr;
          </button>
        </div>

        <div className="tenders-grid">
          {featuredTenders.map((tender) => (
            <div key={tender.id} className="tender-card">
              <div className="card-image-wrapper">
                <img src={tender.image} alt={tender.title} className="card-image" />
                <span className="badge-closing">
                  <span className="dot-indicator"></span> {tender.closingTime}
                </span>
              </div>
              
              <div className="card-body">
                <span className="card-category-badge">{tender.category}</span>
                <h3 className="card-lot-title">
                  <strong>{tender.lotNumber}:</strong> {tender.title}
                </h3>
                <p className="card-description">{tender.description}</p>
                
                <div className="card-footer-row">
                  <div className="bid-box">
                    <span className="bid-label">CURRENT BID</span>
                    <span className="bid-amount">{tender.currentBid}</span>
                  </div>
                  <button className="btn-place-bid" onClick={() => navigate(`/tenders/${tender.id}`)}>
                    PLACE BID
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 4. FOOTER */}
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

      {/* DEBUG PANEL */}
      <div className="debug-db-panel" style={{ padding: '20px', background: '#f5f5f5', borderTop: '2px dashed #ccc', marginTop: '40px' }}>
        <h4>Backend Dev Integration Area</h4>
        <button onClick={loadUsers} className="btn-signin" style={{ background: '#002B49' }}>
          {loading ? "Loading Debug Users..." : "Test Get Users Endpoint"}
        </button>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          {users.map((u, idx) => (
            <div key={idx} style={{ background: '#fff', padding: '5px 10px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <strong>{u.username}</strong> <small>({u.email})</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;