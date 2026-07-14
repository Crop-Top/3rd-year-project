import React, { useState, useEffect } from "react";
import "../styles/LandingPage.css";
import { useNavigate, useLocation } from "react-router-dom"; // Added useLocation here
import { login, getCurrentUser } from "../services/authService";

const LandingPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation(); // Hook initialization verified
  const [alertMessage, setAlertMessage] = useState("");

  // Pulling variables from process.env for Create React App
  const API_BASE = process.env.REACT_APP_API_BASE || "";
  const USER_API = process.env.REACT_APP_USER_API || "";

  // Listen for redirection flash messages coming from the route guards
  useEffect(() => {
    if (location.state && location.state.fromProtected) {
      setAlertMessage(location.state.message);
      
      // Clear out the history state so refreshing doesn't bring the warning back
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log("Fetching URL:", `${API_BASE}${USER_API}`);
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

  // Mock Data mimicking your DB schema for the Featured Active Tenders
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

    try {
        const result = await login(username, password);
        console.log("Authentication Response payload:", result);

        if (result.success) {
            // 1. Unpack the fresh claims stored in application memory
            const user = getCurrentUser();

            if (!user) {
                alert("⚠️ Login was successful, but your user profile metadata could not be parsed.");
                return;
            }

            // 2. Clear out form inputs to ensure clean memory cycles
            setUsername("");
            setPassword("");

            // 3. 🧭 Split paths based cleanly on their cryptographically signed role claim
            if (user.role === "Admin" || user.role === "ProcurementAdmin") {
                console.log(`Access cleared: Welcome Administrator ${user.username}. Entering panel.`);
                navigate("/admin", { replace: true });
            } else if (user.role === "Staff") {
                console.log(`Access cleared: Welcome Staff Member ${user.username}. Entering browse view.`);
                navigate("/browse", { replace: true });
            } else {
                // Fallback catch-all for any generic user accounts or external registrants
                navigate("/browse", { replace: true });
            }

        } else {
            alert(result.data?.message || "Invalid credentials. Please try again.");
        }
    } catch (error) {
        console.error("Sign-in handling pipeline failed entirely:", error);
        alert("Unable to connect to the server.");
    }
  };

  return (
    <div className="portal-container">
      
      {/* AUTHENTICATION ALERT WARNING BANNER */}
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
          <span className="staff-login-label">Staff login</span>
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-input"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
          <button type="submit" className="btn-signin">Sign In</button>
        </form>
      </header>

      {/* 2. BLUE HERO BANNER SECTION */}
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

        {/* TENDER CARDS GRID */}
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
                  <button className="btn-place-bid">PLACE BID</button>
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

      {/* DEBUG HOOK */}
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