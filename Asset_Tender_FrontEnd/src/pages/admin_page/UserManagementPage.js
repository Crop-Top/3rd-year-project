import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, API_BASE_URL } from "../../services/apiClient";
import "../../styles/admin_style/UserManagementPage.css";
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";

const PAGE_SIZE = 10;

// Helper to extract display name and username from Email/DB User object
const mapApiUserToUi = (dbUser) => {
  const emailPrefix = dbUser.email ? dbUser.email.split("@")[0] : "User";
  const formattedName = emailPrefix
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const username = dbUser.username || dbUser.userName || emailPrefix;

  const initials = formattedName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rawRole = (dbUser.role || "Staff").toLowerCase();
  const isAd = !rawRole.includes("bidder") && !rawRole.includes("external");

  const roleType = rawRole.includes("super")
    ? "superadmin"
    : rawRole.includes("admin")
    ? "admin"
    : rawRole.includes("pending")
    ? "pending"
    : rawRole.includes("bidder") || rawRole.includes("external")
    ? "external"
    : "staff";

  const rawStatus = (dbUser.accountStatus || dbUser.status || "Active").toLowerCase();

  const statusType = rawStatus.includes("review")
    ? "pending"
    : rawStatus.includes("pending")
    ? "pending"
    : rawStatus.includes("email") && rawStatus.includes("unverified")
    ? "email-unverified"
    : rawStatus.includes("warn")
    ? "warning"
    : rawStatus.includes("suspend")
    ? "suspended"
    : rawStatus.includes("inact")
    ? "inactive"
    : rawStatus.includes("reject") || rawStatus.includes("block") || rawStatus.includes("disab")
    ? "blocked"
    : "active";

  const avatarColors = {
    superadmin: "gold",
    admin: "navy",
    pending: "navy",
    external: "gray",
    staff: "slate",
  };

  return {
    id: dbUser.userId || dbUser.id || "N/A",
    name: formattedName,
    username: username,
    email: dbUser.email || "N/A",
    role: dbUser.role || "Staff",
    roleType,
    isAdUser: isAd,
    status: dbUser.accountStatus || dbUser.status || "Active",
    statusType,
    initials,
    avatarColor: avatarColors[roleType] || "slate",
    rawUserObj: dbUser,
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

  // System-wide Statistics State
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [adUserCount, setAdUserCount] = useState(0);
  const [externalCount, setExternalCount] = useState(0);

  // Retrieve and safely parse the 'user' object from local storage
  const storedUserRaw = localStorage.getItem("user");
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};

  // Extract role directly from the parsed object
  const currentUserRole = storedUser.role || "Admin"; 
  const isSuperAdmin = currentUserRole.toLowerCase().includes("super");

  // Edit Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    role: "Staff",
    status: "Active",
  });
  const [isSaving, setIsSaving] = useState(false);

  const location = useLocation();
  const accessMessage = location.state?.message;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        search: searchQuery,
      });

      const response = await apiFetch(`${API_BASE_URL}/admin/users?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load users (${response.status})`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const rawText = await response.text();
        throw new Error(`Expected JSON but server returned HTML (${response.status}): ${rawText.slice(0, 80)}...`);
      }

      const data = await response.json();
      const userList = data.items || [];
      const total = data.totalRecords ?? userList.length;

      setUsers(userList.map(mapApiUserToUi));
      setTotalRecords(total);
      setTotalPages(Math.ceil(total / PAGE_SIZE) || 1);

      setActiveCount(data.activeRecordsCount ?? 0);
      setPendingCount(data.pendingCount ?? 0);
      setAdUserCount(data.adUsersCount ?? 0);
      setExternalCount(data.bidderUsersCount ?? 0);
    } catch (err) {
      console.error("Error fetching user data:", err);
      setError(err.message || "Failed to load user records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchQuery]);

  const handleEdit = (userToEdit) => {
    setSelectedUser(userToEdit);
    setEditFormData({
      fullName: userToEdit.name,
      username: userToEdit.username,
      email: userToEdit.email,
      role: userToEdit.role,
      status: userToEdit.status,
    });
    setIsEditModalOpen(true);
  };

  const handleReview = (userToReview) => {
    setSelectedUser(userToReview);
    setIsReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedUser) return;

    try {
      setIsReviewing(true);

      const response = await apiFetch(
        `${API_BASE_URL}/admin/users/${selectedUser.id}/approve`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message || `Failed to approve user (${response.status})`
        );
      }

      setIsReviewModalOpen(false);
      setSelectedUser(null);

      await fetchUsers();
    } catch (err) {
      alert(`Error approving user: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedUser) return;

    const confirmed = window.confirm(
      `Are you sure you want to deny ${selectedUser.name}'s registration?`
    );

    if (!confirmed) return;

    try {
      setIsReviewing(true);

      const response = await apiFetch(
        `${API_BASE_URL}/admin/users/${selectedUser.id}/deny`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message || `Failed to deny user (${response.status})`
        );
      }

      setIsReviewModalOpen(false);
      setSelectedUser(null);

      await fetchUsers();
    } catch (err) {
      alert(`Error denying user: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setIsSaving(true);

      const response = await apiFetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/role-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editFormData.role,
          accountStatus: editFormData.status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update user (${response.status})`);
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      alert(`Error saving user details: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const rows = [
      ["Full Name", "Username", "ID", "Email Address", "Role", "User Type", "Status"],
      ...users.map((u) => [u.name, u.username, u.id, u.email, u.role, u.isAdUser ? "AD Internal" : "External Bidder", u.status]),
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

  return (
    <div className="um-page">
      <PortalHeader />
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

      {/* <header className="um-header">
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
              <span className="um-profile-role">{currentUserRole}</span>
            </div>
            <span className={`um-avatar ${isSuperAdmin ? "um-avatar-gold" : "um-avatar-navy"}`}>
              {isSuperAdmin ? "SA" : "AD"}
            </span>
          </div>
        </div>
      </header> */}

      <main className="um-main">
        <div className="um-content-layout">
          <div className="um-table-column">
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
                    <th>User</th>
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
                        Loading user records...
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
                          {user.statusType === "pending" ? (
                            <button
                              className="um-action-btn"
                              onClick={() => handleReview(user)}
                            >
                              Review
                            </button>
                          ) : user.statusType === "email-unverified" ? null : (
                            <button
                              className="um-action-btn"
                              onClick={() => handleEdit(user)}
                            >
                              Edit
                            </button>
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
          </div>

          <aside className="um-stats-column">
            <div className="um-stat-card um-stat-card-highlight">
              <span className="um-stat-label">Total Users</span>
              <div className="um-stat-value-row">
                <span className="um-stat-value">{totalRecords.toLocaleString()}</span>
              </div>
            </div>

            <div className="um-stat-card">
              <span className="um-stat-label">Active Records</span>
              <div className="um-stat-value-row">
                <span className="um-stat-value">{activeCount}</span>
              </div>
              <span className="um-stat-note um-stat-note-positive">Live Status</span>
            </div>

            <div className="um-stats-pair">
              <div className="um-stat-card">
                <span className="um-stat-label">AD Users</span>
                <div className="um-stat-value-row">
                  <span className="um-stat-value">{adUserCount}</span>
                </div>
                <span className="um-stat-note">Internal (LDAP)</span>
              </div>

              <div className="um-stat-card">
                <span className="um-stat-label">Externals</span>
                <div className="um-stat-value-row">
                  <span className="um-stat-value">{externalCount}</span>
                </div>
                <span className="um-stat-note">Bidders</span>
              </div>
            </div>

            <div
              className="um-stat-card um-stat-card-clickable"
              onClick={() => navigate("/registration-request")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/registration-request");
                }
              }}
            >
              <span className="um-stat-label">Pending Reviews</span>

              <div className="um-stat-value-row">
                <span className="um-stat-value">{pendingCount}</span>
              </div>

              <span className="um-stat-note um-stat-note-warning">
                Needs attention
              </span>
            </div>
          </aside>
        </div>
      </main>

      {/* EDIT USER MODAL */}
      {isEditModalOpen && (
        <div className="um-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="um-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <h3>Edit User Access & Status</h3>
              <button 
                className="um-modal-close" 
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="um-modal-form">
              {/* FULL NAME & USERNAME ROW (READ ONLY) */}
              <div className="um-modal-grid">
                <div className="um-field-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.fullName}
                    className="um-input-disabled"
                  />
                </div>

                <div className="um-field-group">
                  <label>Username</label>
                  <input
                    type="text"
                    disabled
                    value={editFormData.username}
                    className="um-input-disabled"
                  />
                </div>
              </div>

              {/* EMAIL ADDRESS (READ ONLY) */}
              <div className="um-field-group">
                <label>Email Address</label>
                <input
                  type="email"
                  disabled
                  value={editFormData.email}
                  className="um-input-disabled"
                />
              </div>

              {/* ROLE & STATUS ROW */}
              <div className="um-modal-grid">
                <div className="um-field-group">
                  <label>
                    Role {!isSuperAdmin && <span style={{ fontSize: "0.75rem", color: "#64748b" }}>(Requires SuperAdmin)</span>}
                  </label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    disabled={
                      !isSuperAdmin ||
                      editFormData.role.toLowerCase().includes("bidder") || 
                      editFormData.role.toLowerCase().includes("external")
                    }
                    className={!isSuperAdmin ? "um-input-disabled" : ""}
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAdmin">SuperAdmin</option>
                    {(editFormData.role.toLowerCase().includes("bidder") || editFormData.role.toLowerCase().includes("external")) && (
                      <option value={editFormData.role}>{editFormData.role}</option>
                    )}
                  </select>
                </div>

                <div className="um-field-group">
                  <label>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="um-modal-actions">
                <button 
                  type="button" 
                  className="um-btn-cancel"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="um-btn-save"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW USER MODAL */}
      {isReviewModalOpen && selectedUser && (
        <div
          className="um-modal-overlay"
          onClick={() => {
            if (!isReviewing) {
              setIsReviewModalOpen(false);
              setSelectedUser(null);
            }
          }}
        >
          <div
            className="um-review-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="um-review-modal-header">
              <h3>New Company Registration Request</h3>

              <button
                className="um-modal-close"
                onClick={() => {
                  if (!isReviewing) {
                    setIsReviewModalOpen(false);
                    setSelectedUser(null);
                  }
                }}
                aria-label="Close modal"
                disabled={isReviewing}
              >
                &times;
              </button>
            </div>

            {/* CONTENT */}
            <div className="um-review-modal-content">
              <p className="um-review-description">
                A new company has requested access to the Asset Tender Portal.
                Please review their details below to approve or deny their
                registration.
              </p>

              {/* USER DETAILS */}
              <div className="um-review-details">
                <div className="um-review-detail">
                  <span className="um-review-label">Company Name</span>

                  <span className="um-review-value">
                    <span className="um-review-icon">▦</span>
                    {selectedUser.name}
                  </span>
                </div>

                <div className="um-review-detail">
                  <span className="um-review-label">Contact Email</span>

                  <span className="um-review-value">
                    <span className="um-review-icon">✉</span>
                    {selectedUser.email}
                  </span>
                </div>
              </div>

              {/* VERIFICATION STATUS */}
              <div className="um-review-verification">
                <span>VERIFICATION PENDING</span>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="um-review-actions">
              <button
                type="button"
                className="um-review-deny-btn"
                onClick={handleDeny}
                disabled={isReviewing}
              >
                {isReviewing ? "Processing..." : "Deny"}
              </button>

              <button
                type="button"
                className="um-review-approve-btn"
                onClick={handleApprove}
                disabled={isReviewing}
              >
                <span>✓</span>
                {isReviewing ? "Processing..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* <footer className="um-footer">
        <span className="um-footer-title">Asset Tender Portal</span>
        <p className="um-footer-copy">
          &copy; 2026 Nelson Mandela University. All Rights Reserved. Asset Disposal &amp; Tender Division.
        </p>
      </footer> */}
      <PortalFooter />
    </div>
  );
}

export default UserManagementPage;