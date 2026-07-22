import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/staff_style/BrowseAssetsPage.css";
import { fetchSecureUsersList, serviceTriggerSilentRefresh } from "../../services/authService.js";
import { getAllAssets } from "../../services/assetService.js";
import TokenTest from "../../components/TokenTest.js";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function BrowseAssetsPage() {
  const navigate = useNavigate();
  const [tenders] = useState(getAllAssets());

  // NEW STATE: Tracks fetched db items and loading states for your buttons
  const [dbUsers, setDbUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // ACTION: Calls the protected user endpoint via token header
  const handleLoadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const result = await fetchSecureUsersList();

      if (result.success) {
        setDbUsers(result.data);
      } else {
        alert(`❌ API Error:\n${result.message}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // ACTION: Hits the HttpOnly refresh cookie endpoint manually
  const handleSilentRefresh = async () => {
    const res = await serviceTriggerSilentRefresh();
    if (res.success) {
      alert(`🎉 Refresh Successful!\nNew token stored in memory:\n\n${res.token.substring(0, 40)}...`);
    } else {
      alert(`❌ Silent Refresh Denied:\n${res.message}`);
    }
  };

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

        {/* 3. Tenders Container Cards List */}
        <div className="tenders-list">
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
              {/* Card Image Box */}
              <div className="tender-image-placeholder">
                <span className={`status-badge ${tender.statusClass}`}>● {tender.status}</span>
                <div className="image-mock-text">No Image Available</div>
              </div>

              {/* Card Body Details */}
              <div className="tender-details">
                <span className="tender-category">{tender.category}</span>
                <h2 className="tender-title">{tender.title}</h2>
                <p className="tender-description">{tender.description}</p>

                {/* Card Footer */}
                <div className="tender-footer-row">
                  <div className="bid-info">
                    <span className="bid-label">Leading Bid</span>
                    <span className="bid-amount">{formatRand(tender.leadingBid)}</span>
                  </div>
                  <button
                    type="button"
                    className="place-bid-btn btn-dark"
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

        {/* 4. Pagination */}
        <div className="pagination">
          <button className="page-nav-btn">{"<"}</button>
          <button className="page-num-btn active">1</button>
          <button className="page-num-btn">2</button>
          <button className="page-num-btn">3</button>
          <button className="page-nav-btn">{">"}</button>
        </div>
      </main>

      {/* ==================== DEVELOPMENT SECURITY DASHBOARD AREA ==================== */}
      <div
        style={{
          padding: "25px",
          background: "#1e293b",
          color: "#f8fafc",
          borderTop: "4px solid #3b82f6",
          marginTop: "40px",
          fontFamily: "sans-serif",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "#38bdf8" }}>🛡️ JWT Verification Sandbox</h3>
        <p style={{ fontSize: "14px", margin: "0 0 20px 0", color: "#94a3b8" }}>
          Use these tools to manually inspect bearer token authentication and verify the backend refresh
          logic sequence lifecycle live.
        </p>

        {/* Control Row */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
          <button
            onClick={handleLoadUsers}
            style={{
              padding: "10px 20px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isLoadingUsers ? "Querying SQL Database..." : "1. Test Protected GET /api/users"}
          </button>

          <button
            onClick={handleSilentRefresh}
            style={{
              padding: "10px 20px",
              background: "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            2. Execute POST /api/auth/refresh
          </button>
        </div>

        {/* 🛠️ MOUNTED DECODER BOX */}
        <TokenTest />

        {/* Output Table Display Area */}
        {dbUsers.length > 0 && (
          <div
            style={{
              background: "#0f172a",
              padding: "15px",
              borderRadius: "6px",
              border: "1px solid #334155",
              marginTop: "20px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", color: "#a78bfa" }}>Database Payload Authorized:</h4>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {dbUsers.map((user, i) => (
                <li key={i} style={{ fontSize: "14px", color: "#cbd5e1", margin: "5px 0" }}>
                  {`ID: ${user.userId} | Username: ${user.username} | Role: ${user.role} | Status: ${user.accountStatus}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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