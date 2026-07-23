import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/apiClient";
import "../../styles/admin_style/UserManagementPage.css";

// Read API routes from .env file
const API_BASE = process.env.REACT_APP_API_BASE || "https://localhost:7276/";
const USER_ENDPOINT = process.env.REACT_APP_USER_API || "api/User";

// Sanitize base URL trailing slash and endpoint leading slash
const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
const cleanEndpoint = USER_ENDPOINT.startsWith("/") ? USER_ENDPOINT.slice(1) : USER_ENDPOINT;
const USER_API_URL = `${cleanBase}/${cleanEndpoint}`;

const NEEDS_REVIEW = ["pending", "warning"];
const PAGE_SIZE = 10;

const mapApiUserToUi = (dbUser) => {
  const nameParts = (dbUser.fullName || dbUser.username || dbUser.name || "Unknown").split(" ");
  const initials = nameParts.length >= 2 
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : (nameParts[0]?.[0] || "U").toUpperCase();

  const rawRole = (dbUser.role || "Staff").toLowerCase();
  const roleType = rawRole.includes("super") ? "superadmin" 
                 : rawRole.includes("admin") ? "admin" 
                 : rawRole.includes("pending") ? "pending" 
                 : rawRole.includes("external") ? "external" : "staff";

  const rawStatus = (dbUser.status || dbUser.accountStatus || "Active").toLowerCase();
  const statusType = rawStatus.includes("review") ? "pending"
                   : rawStatus.includes("warn") || rawStatus.includes("pend") ? "warning"
                   : rawStatus.includes("inact") ? "inactive"
                   : rawStatus.includes("block") ? "blocked" : "active";

  const avatarColors = {
    superadmin: "gold",
    admin: "navy",
    pending: "navy",
    external: "gray",
    staff: "slate"
  };

  return {
    id: dbUser.id || dbUser.userId || "N/A",
    name: dbUser.fullName || dbUser.username || dbUser.name || "N/A",
    email: dbUser.email || "N/A",
    role: dbUser.role || "Staff",
    roleType,
    status: dbUser.status || dbUser.accountStatus || "Active",
    statusType,
    initials,
    avatarColor: avatarColors[roleType] || "slate",
  };
};

function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const location = useLocation();
  const accessMessage = location.state?.message;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);

        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: PAGE_SIZE.toString(),
          search: searchQuery
        });

        // 1. Replaced raw fetch + manual token header with apiFetch
        const response = await apiFetch(`${USER_API_URL}?${queryParams.toString()}`);

        // 2. Check if the response is OK (apiFetch handled any 401 retry behind the scenes)
        if (!response.ok) {
          throw new Error(`Failed to load users (${response.status})`);
        }

        const data = await response.json();
        
        const userList = Array.isArray(data) ? data : (data.items || data.users || []);
        const total = data.totalRecords ?? data.total ?? userList.length;

        const mappedUsers = userList.map(mapApiUserToUi);
        
        // Count database records where AccountStatus is pending
        const pendingTotal = mappedUsers.filter(u => u.statusType === "pending" || u.statusType === "warning").length;

        setUsers(mappedUsers);
        setTotalRecords(total);
        setPendingCount(data.pendingCount ?? pendingTotal);
        setTotalPages(Math.ceil(total / PAGE_SIZE) || 1);
        setError(null);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError(err.message || "Failed to load user records");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentPage, searchQuery]);

  // Navigate to /registration-request with staff permission check
  const handlePendingReviewsClick = (user = null) => {
    const storedUser = localStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;

    const userRole = (currentUser?.role || currentUser?.roleType || "").toLowerCase();
    
    // Check if user is staff (or admin/superadmin)
    const isStaff = userRole.includes("staff") || userRole.includes("admin");

    if (!isStaff) {
      alert("Access Denied: Only staff members can view registration requests.");
      return;
    }

    // Navigates to registration requests page (passes user context in state if needed)
    navigate("/registration-request", { state: { selectedUser: user } });
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const rows = [
      ["Full Name", "ID", "Email Address", "Role", "Status"],
      ...users.map((u) => [u.name, u.id, u.email, u.role, u.status]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset-tender-users-page-${currentPage}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Linked directly to pending review navigation logic
  const handleView = (user) => {
    handlePendingReviewsClick(user);
  };

  const handleEdit = (userToEdit) => {
    const storedUser = localStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;

    const userRole = (currentUser?.role || currentUser?.roleType || "").toLowerCase();
    const isAdmin = userRole.includes("admin");

    if (!isAdmin) {
      alert("Access Denied: Only administrators can edit user details.");
      return;
    }

    navigate("/edit-user-details", { 
      state: { user: userToEdit } 
    });
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(`Remove ${user.name} from the system?`);
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${USER_API_URL}/${user.id}`, { 
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      if (!res.ok) throw new Error("Failed to delete user");

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      alert(`Could not delete user: ${err.message}`);
    }
  };

  // Dynamic Stats Cards Configuration
  const statsList = [
    { label: "Total Users", value: totalRecords.toLocaleString(), delta: "+12 this month", highlight: true },
    { label: "Active Records", value: users.filter(u => u.statusType === "active").length, note: "Live Status", noteType: "positive" },
    { 
      label: "Pending Reviews", 
      value: pendingCount, 
      note: "Needs attention", 
      noteType: "warning",
      isClickable: true,
      onClick: () => handlePendingReviewsClick()
    },
    { label: "User Activity", value: "04", note: "AD Synced", noteType: "muted" },
  ];

  return (
    <div className="um-page">
      {accessMessage && (
        <div
          className="um-access-banner"
          style={{
            padding: "12px 20px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderBottom: "1px solid #f87171",
            fontWeight: "500",
            textAlign: "center",
          }}
        >
          ⚠️ {accessMessage}
        </div>
      )}

      <header className="um-header">
        <div className="um-header-left">
          <div className="um-logo">
            <span className="um-logo-crest">NM</span>
            <span className="um-logo-text">
              NELSON MANDELA
              <br />
              UNIVERSITY
            </span>
          </div>
          <span className="um-divider" />
          <span className="um-title">Asset Tender Portal</span>
          <span className="um-divider" />
          <span className="um-subtitle">Enterprise Administrative Control</span>
        </div>

        <div className="um-header-right">
          <button className="um-bell-btn" aria-label="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <span className="um-divider" />
          <div className="um-profile">
            <div className="um-profile-text">
              <span className="um-profile-name">Admin Profile</span>
              <span className="um-profile-role">System Administrator</span>
            </div>
            <span className="um-avatar um-avatar-gold">SA</span>
          </div>
        </div>
      </header>

      <main className="um-main">
        <section className="um-stats-row">
          {statsList.map((stat) => (
            <div
              key={stat.label}
              className={`um-stat-card${stat.highlight ? " um-stat-card-highlight" : ""}${stat.isClickable ? " um-stat-card-clickable" : ""}`}
              onClick={stat.onClick}
              style={stat.isClickable ? { cursor: "pointer" } : undefined}
              role={stat.isClickable ? "button" : undefined}
              tabIndex={stat.isClickable ? 0 : undefined}
            >
              <span className="um-stat-label">{stat.label}</span>
              <div className="um-stat-value-row">
                <span className="um-stat-value">{stat.value}</span>
                {stat.delta && <span className="um-stat-delta">{stat.delta}</span>}
              </div>
              {stat.note && (
                <span className={`um-stat-note um-stat-note-${stat.noteType}`}>
                  {stat.noteType === "warning" && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                  {stat.note}
                </span>
              )}
            </div>
          ))}
        </section>

        <section className="um-toolbar">
          <div className="um-search">
            <svg className="um-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>

          <div className="um-toolbar-actions">
            <button className="um-btn-outline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              Filter
            </button>
            <button className="um-btn-outline" onClick={handleExportCsv}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        </section>

        <section className="um-table-card">
          <table className="um-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>ID</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th className="um-actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="um-empty-row">
                    Loading records (Page {currentPage})...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={6} className="um-empty-row" style={{ color: "#dc2626" }}>
                    ⚠️ Error: {error}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="um-name-cell">
                        <span className={`um-avatar um-avatar-${user.avatarColor}`}>
                          {user.initials}
                        </span>
                        <span className="um-name-link">{user.name}</span>
                      </div>
                    </td>
                    <td className="um-muted-cell">#{user.id}</td>
                    <td className="um-email-cell">{user.email}</td>
                    <td>
                      <span className={`um-role-badge um-role-${user.roleType}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`um-status-badge um-status-${user.statusType}`}>
                        <span className="um-status-dot" />
                        {user.status}
                      </span>
                    </td>
                    <td className="um-actions-cell">
                      {NEEDS_REVIEW.includes(user.statusType) ? (
                        <button className="um-btn-view" onClick={() => handleView(user)}>
                          View
                        </button>
                      ) : (
                        <>
                          <button
                            className="um-icon-btn"
                            aria-label="Edit user"
                            onClick={() => handleEdit(user)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 2 2h14a2 2 0 0 2 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="um-icon-btn um-icon-btn-danger"
                            aria-label="Delete user"
                            onClick={() => handleDelete(user)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

              {!loading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="um-empty-row">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              borderTop: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              color: "#64748b",
            }}
          >
            <span>
              Showing {users.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{" "}
              {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} users
            </span>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="um-btn-outline"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                style={{ opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              <span style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="um-btn-outline"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                style={{ opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="um-audit-panel">
          <div className="um-audit-text">
            <h2>System Audit Log</h2>
            <p>
              Monitor provisioning events and permission escalations in
              real-time. Only SuperAdmins have visibility into the full
              institutional ledger.
            </p>
          </div>
          <button className="um-btn-outline">View Full Audit Trail</button>
        </section>
      </main>

      <footer className="um-footer">
        <span className="um-footer-title">Asset Tender Portal</span>
        <nav className="um-footer-links">
          <a href="/terms">Terms of Use</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/faq">Tender FAQ</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/contact">Contact Procurement</a>
        </nav>
        <p className="um-footer-copy">
          &copy; 2024 Nelson Mandela University. All Rights Reserved. Asset
          Disposal &amp; Tender Division.
        </p>
      </footer>
    </div>
  );
}

export default UserManagementPage;