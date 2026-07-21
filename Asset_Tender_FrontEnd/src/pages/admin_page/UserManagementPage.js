import { useState } from "react";
import "../../styles/admin_style/UserManagementPage.css";

const INITIAL_USERS = [
  {
    id: "NMU-8291",
    name: "John Doe",
    email: "john.doe@mandela.ac.za",
    role: "Pending Review",
    roleType: "pending",
    status: "Pending Review",
    statusType: "pending",
    initials: "JD",
    avatarColor: "navy",
  },
  {
    id: "NMU-7720",
    name: "Burt K.",
    email: "bk@globalfleet.com",
    role: "External",
    roleType: "external",
    status: "Pending",
    statusType: "warning",
    initials: "BK",
    avatarColor: "gray",
  },
  {
    id: "NMU-4432",
    name: "Thabo S.",
    email: "t.sithole@mandela.ac.za",
    role: "Staff",
    roleType: "staff",
    status: "Inactive",
    statusType: "inactive",
    initials: "TS",
    avatarColor: "slate",
  },
  {
    id: "NMU-0012",
    name: "Admin User",
    email: "admin@mandela.ac.za",
    role: "Admin",
    roleType: "admin",
    status: "Blocked",
    statusType: "blocked",
    initials: "AM",
    avatarColor: "navy",
  },
  {
    id: "NMU-0001",
    name: "Super Admin",
    email: "sa@mandela.ac.za",
    role: "SA",
    roleType: "superadmin",
    status: "Active",
    statusType: "active",
    initials: "SA",
    avatarColor: "gold",
  },
];

const STATS = [
  { label: "Total Users", value: "1,248", delta: "+12 this month", highlight: true },
  { label: "Active Records", value: "4,892", note: "Live Status", noteType: "positive" },
  { label: "Pending Reviews", value: "87", note: "Needs attention", noteType: "warning" },
  { label: "User Activity", value: "04", note: "AD Synced", noteType: "muted" },
];

const NEEDS_REVIEW = ["pending", "warning"];

function UserManagementPage() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e) => setSearchQuery(e.target.value);

  const handleExportCsv = () => {
    const rows = [
      ["Full Name", "ID", "Email Address", "Role", "Status"],
      ...filteredUsers.map((u) => [u.name, u.id, u.email, u.role, u.status]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asset-tender-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleView = (user) => {
    console.log("Viewing user record:", user);
  };

  const handleEdit = (user) => {
    console.log("Editing user record:", user);
  };

  const handleDelete = (user) => {
    const confirmed = window.confirm(`Remove ${user.name} from the system?`);
    if (!confirmed) return;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
  };

  const filteredUsers = users.filter((u) =>
    [u.name, u.id, u.email, u.role].some((field) =>
      field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="um-page">
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
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className={`um-stat-card${stat.highlight ? " um-stat-card-highlight" : ""}`}
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
              {filteredUsers.map((user) => (
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
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
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

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="um-empty-row">
                    No records found matching "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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