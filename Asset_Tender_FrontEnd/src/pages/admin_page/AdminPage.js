import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/admin_style/AdminPage.css";
import "../../styles/shared/TenderCard.css";
import { 
  getLiveTendersForAdmin, 
  getPendingTenders, 
  retractTender, 
  getPendingInvoiceRequests // Service function for fetching pending invoice requests
} from "../../services/assetService";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import { formatViewingSentence } from "../../utils/viewingDisplay";

function AdminPage({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [bannerMessage, setBannerMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tenders, setTenders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0); // State for pending invoice count
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retractingId, setRetractingId] = useState(null);

  // Retract Modal State
  const [retractModal, setRetractModal] = useState({ show: false, tender: null, reason: "" });
  const [retractError, setRetractError] = useState("");
  const [showRetractSuccessModal, setShowRetractSuccessModal] = useState(false);

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

        // Load Pending Approvals for Super Admin
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

        // Load Pending Invoice Requests for Admins
        if (checkIsAdmin()) {
          try {
            const pendingInvoices = await getPendingInvoiceRequests();
            if (!cancelled && Array.isArray(pendingInvoices)) {
              setInvoiceCount(pendingInvoices.length);
            }
          } catch (err) {
            console.error("Failed to load invoice request count:", err);
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

  const handleInvoiceRequestsClick = () => {
    if (checkIsAdmin()) {
      navigate("/invoice-requests");
    } else {
      alert("Access Denied: Only administrators can access Invoice Requests.");
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
      const id = tender.listingId || tender.id;
      navigate(`/tender-detail/${id}`);
    } else {
      alert("Access Denied: Only administrators can view tender details.");
    }
  };

  const handleEditTender = (e, tender) => {
    e.stopPropagation();
    if (checkIsSuperAdmin()) {
      navigate("/edit-tender", { state: { tender } });
    } else {
      alert("Access Denied: Only Super Admins can edit tenders.");
    }
  };

  // Open Retract Modal
  const openRetractModal = (e, tender) => {
    e.stopPropagation();
    if (!checkIsAdmin()) {
      alert("Access Denied: Only administrators can retract active tenders.");
      return;
    }
    setRetractError("");
    setRetractModal({ show: true, tender, reason: "" });
  };

  // Close Retract Modal
  const closeRetractModal = () => {
    setRetractModal({ show: false, tender: null, reason: "" });
    setRetractError("");
  };

  // Submit Retraction
  const confirmRetractTender = async (e) => {
    e.preventDefault();
    if (!retractModal.reason.trim()) {
      setRetractError("Please enter a reason for retracting this tender.");
      return;
    }

    const targetTender = retractModal.tender;
    const idToRetract = targetTender?.listingId || targetTender?.id;

    try {
      setRetractingId(idToRetract);
      setRetractError("");
      await retractTender(idToRetract, retractModal.reason.trim());

      setTenders((prev) => prev.filter((t) => (t.listingId || t.id) !== idToRetract));
      closeRetractModal();
      setShowRetractSuccessModal(true);
    } catch (err) {
      setRetractError(err.message || "Failed to retract tender.");
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

          {/* NEW INVOICE REQUESTS BUTTON WITH BADGE */}
          <button
            className="admin-btn admin-btn-secondary admin-btn-has-badge"
            onClick={handleInvoiceRequestsClick}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Invoice Requests
            {invoiceCount > 0 && (
              <span className="admin-notification-badge">{invoiceCount}</span>
            )}
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
              const offersCount = tender.bidCount ?? tender.offersCount ?? tender.totalBids ?? 0;

              return (
                <div 
                  key={tenderId} 
                  className="tender-card"
                  onClick={() => handleViewTenderDetails(tender)}
                  style={{ cursor: "pointer" }}
                >
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

                    {/* PUSHED DOWN WITH MARGIN-TOP */}
                    <div style={{ marginTop: "24px" }}>
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

                      {formatViewingSentence(tender) && (
                        <p className="tender-viewing-date">
                          {formatViewingSentence(tender)}
                        </p>
                      )}

                      <div style={{ marginTop: "8px" }}>
                        <p className="tender-label">Offers Placed</p>
                        <p className="tender-price" style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                          {offersCount}
                        </p>
                      </div>
                    </div>

                    <div className="tender-footer">
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", width: "100%" }}>
                        <button
                          className="tender-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTenderDetails(tender);
                          }}
                          title="View Tender Details"
                          style={{ flex: "1 1 auto", padding: "6px 10px", fontSize: "0.85rem" }}
                        >
                          Details
                        </button>

                        {checkIsSuperAdmin() && (
                          <button
                            className="admin-btn admin-btn-secondary"
                            onClick={(e) => handleEditTender(e, tender)}
                            title="Edit Tender"
                            style={{ 
                              flex: "1 1 auto", 
                              padding: "6px 10px", 
                              fontSize: "0.85rem",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              textAlign: "center"
                            }}
                          >
                            Edit
                          </button>
                        )}

                        <button
                          onClick={(e) => openRetractModal(e, tender)}
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

      {/* RETRACT REASON INPUT MODAL */}
      {retractModal.show && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={closeRetractModal}
        >
          <div 
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", color: "#0f172a" }}>
              Retract Tender
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 16px 0" }}>
              Are you sure you want to retract <strong>"{retractModal.tender?.title}"</strong>? Please provide a reason for the retraction.
            </p>

            {retractError && (
              <div style={{ padding: "10px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "16px", fontSize: "0.875rem" }}>
                {retractError}
              </div>
            )}

            <form onSubmit={confirmRetractTender}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                  Reason for Retraction *
                </label>
                <textarea
                  rows={4}
                  value={retractModal.reason}
                  onChange={(e) => setRetractModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Asset recalled by department / Pricing error..."
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={closeRetractModal}
                  disabled={retractingId !== null}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retractingId !== null}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    fontWeight: "600",
                    cursor: retractingId !== null ? "not-allowed" : "pointer",
                    opacity: retractingId !== null ? 0.7 : 1,
                  }}
                >
                  {retractingId !== null ? "Retracting..." : "Confirm Retraction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETRACT SUCCESS MODAL */}
      {showRetractSuccessModal && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={() => setShowRetractSuccessModal(false)}
        >
          <div 
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              width: "100%",
              maxWidth: "420px",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: "#dcfce7",
                color: "#16a34a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: "bold",
                margin: "0 auto 16px auto",
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", color: "#0f172a" }}>
              Tender Retracted
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 24px 0", lineHeight: "1.4" }}>
              The tender has been successfully retracted and all active bidders have been notified.
            </p>
            <button
              type="button"
              onClick={() => setShowRetractSuccessModal(false)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "0.95rem",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}

export default AdminPage;