

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/admin_style/AdminPage.css";
import "../../styles/shared/TenderCard.css";
import { getLiveTendersForAdmin } from "../../services/assetService";
 
const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
 
function AdminPage({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
 
  const [bannerMessage, setBannerMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
 
  useEffect(() => {
    if (location.state?.accessDenied && location.state?.message) {
      setBannerMessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);
 
  useEffect(() => {
    let cancelled = false;
 
    async function loadLiveTenders() {
      try {
        setLoading(true);
        setLoadError("");
        const rows = await getLiveTendersForAdmin();
        if (!cancelled) setTenders(rows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load live tenders.");
          setTenders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
 
    loadLiveTenders();
    return () => {
      cancelled = true;
    };
  }, []);
 
  const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");
 
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };
 
  const checkIsAdmin = () => {
    const role = (currentUser?.role || currentUser?.roleType || "").toLowerCase();
    return role.includes("admin");
  };
 
  const handlePendingApprovalsClick = () => {
    if (checkIsAdmin()) {
      navigate("/pending-approvals");
    } else {
      alert("Access Denied: Only users with the Admin role can access Pending Approvals.");
    }
  };
 
  const handleCreateNewTenderClick = () => {
    if (checkIsAdmin()) {
      navigate("/create-tender");
    } else {
      alert("Access Denied: Only users with the Admin role can post new tenders.");
    }
  };
 
  const handleUserManagementClick = () => {
    if (checkIsAdmin()) {
      navigate("/user-management");
    } else {
      alert("Access Denied: Only users with the Admin role can access User Management.");
    }
  };
 
  const handleViewTenderDetails = (tender) => {
    if (checkIsAdmin()) {
      navigate(`/tender-detail/${tender.listingId}`);
    } else {
      alert("Access Denied: Only administrators can view tender details.");
    }
  };
 
  const handleEditTender = (tender) => {
    if (checkIsAdmin()) {
      navigate("/edit-tender", { state: { tender } });
    } else {
      alert("Access Denied: Only administrators can edit tenders.");
    }
  };
 
  const filteredTenders = tenders.filter((tender) => {
    const q = searchQuery.toLowerCase();
    return (
      (tender.title || "").toLowerCase().includes(q) ||
      (tender.category || "").toLowerCase().includes(q)
    );
  });
 
  return (
    <div className="admin-page">
      {bannerMessage && (
        <div
          style={{
            padding: "14px 20px",
            backgroundColor: "#fef2f2",
            borderLeft: "5px solid #ef4444",
            color: "#991b1b",
            marginBottom: "20px",
            borderRadius: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div>
            <strong style={{ fontSize: "15px" }}>⛔ Access Restricted</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>{bannerMessage}</p>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#991b1b",
              fontSize: "18px",
              cursor: "pointer",
              fontWeight: "bold",
              paddingLeft: "15px",
            }}
          >
            ✕
          </button>
        </div>
      )}
 
      <header className="admin-header">
        <div className="admin-header-top">
          <h1 className="admin-title">Asset Tender Portal</h1>
          <div className="admin-search">
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={handleSearch}
              className="admin-search-input"
            />
            <svg className="admin-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>
 
        <div className="admin-actions">
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleUserManagementClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            User Management
          </button>
 
          <button
            className="admin-btn admin-btn-secondary"
            onClick={handlePendingApprovalsClick}
          >
            Pending Approvals
          </button>
 
          <button
            className="admin-btn admin-btn-accent"
            onClick={handleCreateNewTenderClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Post New Tender
          </button>
        </div>
      </header>
 
      <section className="admin-section">
        <h2 className="admin-section-title">Live Asset Tenders</h2>
 
        {loading && <div className="tender-loading">Loading live tenders...</div>}
        {loadError && (
          <div className="tender-empty">
            <p style={{ color: "#b91c1c" }}>{loadError}</p>
          </div>
        )}
 
        {!loading && !loadError && filteredTenders.length > 0 && (
          <div className="tender-grid">
            {filteredTenders.map((tender) => (
              <div key={tender.id} className="tender-card">
                <div className="tender-image-wrapper">
                  {tender.image ? (
                    <img src={tender.image} alt={tender.title} className="tender-image" />
                  ) : (
                    <div className="tender-image-fallback">No Image Available</div>
                  )}
                  <span className="tender-badge">{tender.category}</span>
                  {tender.status && (
                    <span className={`status-badge ${tender.statusClass || ""}`}>
                      ● {tender.status}
                    </span>
                  )}
                </div>
 
                <div className="tender-content">
                  <h3 className="tender-title">{tender.title}</h3>
                  <p className="tender-description">{tender.description}</p>
 
                  <div className="tender-footer">
                    <div>
                      <p className="tender-label">Leading Bid</p>
                      <p className="tender-price">{formatRand(tender.leadingBid)}</p>
                    </div>
 
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="tender-btn"
                        onClick={() => handleViewTenderDetails(tender)}
                        title="View Tender Details"
                      >
                        View Tender Details
                      </button>
                      <button
                        className="admin-btn admin-btn-secondary"
                        onClick={() => handleEditTender(tender)}
                        title="Edit Tender"
                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                      >
                        Edit Tender
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
 
        {!loading && !loadError && filteredTenders.length === 0 && (
          <div className="tender-empty">
            <p>
              {searchQuery
                ? `No tenders found matching "${searchQuery}"`
                : "No live asset tenders are available yet."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
 
export default AdminPage;
 
