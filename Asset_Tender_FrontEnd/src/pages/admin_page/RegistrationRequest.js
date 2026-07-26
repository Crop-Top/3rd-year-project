import React, { useState, useEffect } from 'react';
import "../../styles/admin_style/RegistrationRequest.css";
import NewCompanyRegistrationModal from './NewCompanyRegistrationModal'; // Adjust path if needed

// 1. Declare API Base constants at the VERY TOP of the file outside the component
const API_BASE = process.env.REACT_APP_API_BASE || "https://localhost:7276/";
const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

const USER_ENDPOINT = process.env.REACT_APP_USER_API || "api/User";
const cleanEndpoint = USER_ENDPOINT.startsWith("/") ? USER_ENDPOINT.slice(1) : USER_ENDPOINT;

// Full URLs constructed AFTER cleanBase is defined
const USER_API_URL = `${cleanBase}/${cleanEndpoint}`;
const ADMIN_USERS_API = `${cleanBase}/api/admin/users`;

const RegistrationRequestPage = () => {
  const [requests, setRequests] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      let token = localStorage.getItem("accessToken");

      if (!token) {
        const storedUser = localStorage.getItem("user") || localStorage.getItem("auth");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            token = parsed.accessToken || parsed.token;
          } catch (e) {
            console.error("Error parsing stored auth object", e);
          }
        }
      }

      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const response = await fetch(`${USER_API_URL}?search=Pending&limit=100`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("401 Unauthorized: Invalid or expired token. Please log in again.");
        }
        if (response.status === 403) {
          throw new Error("403 Forbidden: Admin or SuperAdmin role required.");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const userList = data.items || [];

      const pendingUsers = userList.filter(
        (u) => u.status && u.status.toLowerCase() === "pending"
      );

      const formatted = pendingUsers.map((user) => ({
        id: user.userId,
        name: user.fullName || "N/A",
        email: user.email,
        status: user.status,
        image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600',
        submittedOn: 'Pending Review',
      }));

      setRequests(formatted);
    } catch (err) {
      console.error("Error fetching pending registrations:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openReview = (request) => setActiveRequest(request);
  const closeReview = () => setActiveRequest(null);

  // APPROVE HANDLER
  const handleApprove = async () => {
    if (!activeRequest) return;

    try {
      setIsProcessing(true);
      let token = localStorage.getItem("accessToken");

      if (!token) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          token = JSON.parse(storedUser).accessToken;
        }
      }

      const response = await fetch(`${ADMIN_USERS_API}/${activeRequest.id}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.Message || "Failed to approve user.");
      }

      // Optimistically remove approved user from UI
      setRequests((prev) => prev.filter((r) => r.id !== activeRequest.id));
      closeReview();
    } catch (err) {
      console.error("Approve error:", err);
      alert(`Approval failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // DENY HANDLER
  const handleDeny = async () => {
    if (!activeRequest) return;

    try {
      setIsProcessing(true);
      let token = localStorage.getItem("accessToken");

      if (!token) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          token = JSON.parse(storedUser).accessToken;
        }
      }

      const response = await fetch(`${ADMIN_USERS_API}/${activeRequest.id}/deny`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.Message || "Failed to decline user.");
      }

      // Optimistically remove denied user from UI
      setRequests((prev) => prev.filter((r) => r.id !== activeRequest.id));
      closeReview();
    } catch (err) {
      console.error("Deny error:", err);
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pa-layout">
      <div className="pa-main">
        <header className="pa-topbar">
          <h1 className="pa-topbar-title">Pending Approvals</h1>
          <div className="pa-topbar-profile">
            <div className="pa-topbar-avatar">A</div>
            <span className="pa-topbar-name">Admin</span>
          </div>
        </header>

        <div className="pa-content">
          <div className="pa-content-header">
            <p className="pa-content-subtitle">
              Review new company registration requests before granting portal access.
            </p>
            <span className="pa-count-badge">{requests.length} pending</span>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "16px" }}>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="pa-empty-state">
              <p>Loading pending requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="pa-empty-state">
              <p>No pending registration requests right now.</p>
            </div>
          ) : (
            <div className="pa-table">
              <div className="pa-table-head">
                <span>Company / User Name</span>
                <span>Contact Email</span>
                <span>Status</span>
                <span className="pa-table-head-action">Action</span>
              </div>

              {requests.map((request) => (
                <div className="pa-table-row" key={request.id}>
                  <span className="pa-table-company">{request.name}</span>
                  <span className="pa-table-email">{request.email}</span>
                  <span className="pa-table-date">{request.status}</span>
                  <button
                    type="button"
                    className="pa-review-btn"
                    onClick={() => openReview(request)}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeRequest && (
        <NewCompanyRegistrationModal
          company={{
            name: activeRequest.name,
            email: activeRequest.email,
            image: activeRequest.image,
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onClose={closeReview}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default RegistrationRequestPage;