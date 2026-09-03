import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/admin_style/AdminPage.css";
import "../../styles/shared/TenderCard.css";
import { getLiveTendersForAdmin, getPendingTenders, retractTender } from "../../services/assetService";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function AdminPage({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [bannerMessage, setBannerMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenders, setTenders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retractingId, setRetractingId] = useState(null); // Track pending retraction state

  const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");

  const checkIsSuperAdmin = () => {
    const role = (currentUser?.role || currentUser?.roleType || "").toLowerCase();
    return role.includes("superadmin") || role.includes("super admin") || role.includes("super_admin");
  };

  const checkIsAdmin = () => {
    const role = (currentUser?.role || currentUser?.roleType || "").toLowerCase();
    return role.includes("admin");
  };

  useEffect(() => {
    if (location.state?.accessDenied && location.state?.message) {
      setBannerMessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError("");

        const rows = await getLiveTendersForAdmin();
        if (!cancelled) setTenders(rows);

        if (checkIsSuperAdmin()) {
          try {
            const pendingTenders = await getPendingTenders();
            if (!cancelled && Array.isArray(pendingTenders)) {
              setPendingCount(pendingTenders.length);
            }
          } catch (err) {
            console.error("Failed to load pending count:", err);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load live tenders.");
          setTenders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handlePendingApprovalsClick = () => {
    if (checkIsSuperAdmin()) {
      navigate("/pending-approvals");
    } else {
      alert("Access Denied: Only Super Admin accounts can access Pending Approvals.");
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

  // Retraction execution handler
  const handleRetractTender = async (tender) => {
    if (!checkIsAdmin()) {
      alert("Access Denied: Only administrators can retract active tenders.");
      return;
    }

    const idToRetract = tender.listingId || tender.id;

    // Prompt the admin for a cancellation reason to send in the email body
    const reason = window.prompt(`Enter a reason for retracting "${tender.title}":`);
    
    // If the admin cancels the prompt, stop execution
    if (reason === null) return; 

    try {
      setRetractingId(idToRetract);
      await retractTender(idToRetract, reason);

      setTenders((prev) => prev.filter((t) => (t.listingId || t.id) !== idToRetract));
      alert("Tender has been successfully retracted and bidders notified.");
    } catch (err) {
      alert(`Failed to retract tender: ${err.message || "An error occurred."}`);
    } finally {
      setRetractingId(null);
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
      <PortalHeader />
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
            className="admin-btn admin-btn-accent"
            onClick={handleCreateNewTenderClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Post New Tender
          </button>

          {checkIsSuperAdmin() && (
            <button
              className="admin-btn admin-btn-secondary admin-btn-has-badge"
              onClick={handlePendingApprovalsClick}
            >
              Pending Approvals
              {pendingCount > 0 && (
                <span className="admin-notification-badge">{pendingCount}</span>
              )}
            </button>
          )}
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
            {filteredTenders.map((tender) => {
              const tenderId = tender.listingId || tender.id;
              const isRetracting = retractingId === tenderId;

              return (
                <div key={tenderId} className="tender-card">
                  <div className="tender-image-wrapper">
                    {tender.image ? (
                      <img src={tender.image} alt={tender.title} className="tender-image" />
                    ) : (
                      <div className="tender-image-fallback">No Image Available</div>
                    )}
                    <span className="tender-badge">{tender.category}</span>
                  </div>

                  <div className="tender-content">
                    <h3 className="tender-title">{tender.title}</h3>
                    <p className="tender-description">{tender.description}</p>

                    {tender.status && (
                      <div className="status-line">
                        <span
                          className={`status-dot ${
                            tender.statusClass === "status-urgent" ? "status-dot-urgent" : "status-dot-active"
                          }`}
                        />
                        Status: {tender.statusClass === "status-urgent" ? tender.status : "Live"}
                      </div>
                    )}

                    <div>
                      <p className="tender-label">Leading Bid</p>
                      <p className="tender-price">{formatRand(tender.leadingBid)}</p>
                    </div>

                    <div className="tender-footer">
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", width: "100%" }}>
                        <button
                          className="tender-btn"
                          onClick={() => handleViewTenderDetails(tender)}
                          title="View Tender Details"
                          style={{ flex: "1 1 auto", padding: "6px 10px", fontSize: "0.85rem" }}
                        >
                          Details
                        </button>
                        <button
                          className="admin-btn admin-btn-secondary"
                          onClick={() => handleEditTender(tender)}
                          title="Edit Tender"
                          style={{ flex: "1 1 auto", padding: "6px 10px", fontSize: "0.85rem" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRetractTender(tender)}
                          disabled={isRetracting}
                          title="Retract Tender"
                          style={{
                            flex: "1 1 auto",
                            padding: "6px 10px",
                            fontSize: "0.85rem",
                            backgroundColor: "#ef4444",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: isRetracting ? "not-allowed" : "pointer",
                            opacity: isRetracting ? 0.6 : 1,
                            fontWeight: "600",
                          }}
                        >
                          {isRetracting ? "Retracting..." : "Retract"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
      <PortalFooter />
    </div>
  );
}

export default AdminPage;