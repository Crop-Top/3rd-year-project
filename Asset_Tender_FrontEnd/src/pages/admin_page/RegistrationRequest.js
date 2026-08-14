import React, { useState, useEffect, useCallback } from 'react';
import NewCompanyRegistrationModal from '../../components/NewCompanyRegistrationModal';
import '../../styles/admin_style/RegistrationRequest.css';
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

// Helper to get user role from local state / token
const getUserRole = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Handles standard JWT claim or ASP.NET Identity role claim key
    return (
      payload.role ||
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      ''
    );
  } catch {
    return null;
  }
};

const RegistrationRequestPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRequest, setActiveRequest] = useState(null);

  const userRole = getUserRole();
  const isSuperAdmin = userRole?.toLowerCase() === 'superadmin';

  // Fetch pending registration requests
  const fetchPendingRequests = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      setLoading(true);
      setError('');

      const res = await apiFetch(`${API_BASE_URL}/admin/users?search=Pending&limit=100`);

      if (!res.ok) {
        throw new Error(`Failed to load pending requests (HTTP ${res.status})`);
      }

      const data = await res.json();
      const rawItems = Array.isArray(data) ? data : data?.items || [];

      const pendingUsers = rawItems.filter(
        (u) => (u.status || u.accountStatus || '').toLowerCase() === 'pending'
      );

      setRequests(pendingUsers);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(err.message || 'Failed to load pending requests.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  // 🚨 Guardrail: If not SuperAdmin, block view entirely
  if (!isSuperAdmin) {
    return (
      <div className="pa-layout">
        <div className="pa-main" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>⚠️ Access Restricted</h2>
          <p>Only Super Administrators have permission to review pending approvals.</p>
        </div>
      </div>
    );
  }

  const openReview = (request) => setActiveRequest(request);
  const closeReview = () => setActiveRequest(null);

  const handleApprove = async () => {
    if (!activeRequest) return;
    const targetId = activeRequest.userId || activeRequest.id;

    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/users/${targetId}/approve`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.Message || 'Approval failed');
      }

      setRequests((prev) => prev.filter((r) => (r.userId || r.id) !== targetId));
      closeReview();
    } catch (err) {
      alert(`Failed to approve: ${err.message}`);
    }
  };

  const handleDeny = async () => {
    if (!activeRequest) return;
    const targetId = activeRequest.userId || activeRequest.id;

    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/users/${targetId}/deny`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.Message || 'Rejection failed');
      }

      setRequests((prev) => prev.filter((r) => (r.userId || r.id) !== targetId));
      closeReview();
    } catch (err) {
      alert(`Failed to decline: ${err.message}`);
    }
  };

  return (
    <div className="pa-layout">
      <div className="pa-main">
        <header className="pa-topbar">
          <h1 className="pa-topbar-title">Pending Approvals</h1>
          <div className="pa-topbar-profile">
            <div className="pa-topbar-avatar">SA</div>
            <span className="pa-topbar-name">Super Admin</span>
          </div>
        </header>

        <div className="pa-content">
          <div className="pa-content-header">
            <p className="pa-content-subtitle">
              Review new registration requests before granting portal access.
            </p>
            <span className="pa-count-badge">{requests.length} pending</span>
          </div>

          {loading ? (
            <div className="pa-empty-state">
              <p>Loading pending requests...</p>
            </div>
          ) : error ? (
            <div className="pa-empty-state">
              <p style={{ color: '#dc2626' }}>⚠️ {error}</p>
              <button type="button" className="pa-review-btn" onClick={fetchPendingRequests}>
                Retry
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="pa-empty-state">
              <p>No pending registration requests right now.</p>
            </div>
          ) : (
            <div className="pa-table">
              <div className="pa-table-head">
                <span>Company Name</span>
                <span>Contact Email</span>
                <span>Submitted</span>
                <span className="pa-table-head-action">Action</span>
              </div>

              {requests.map((request) => {
                const reqId = request.userId || request.id;
                const companyName = request.companyName || request.fullName || request.username;
                const email = request.email;

                return (
                  <div className="pa-table-row" key={reqId}>
                    <span className="pa-table-company">{companyName}</span>
                    <span className="pa-table-email">{email}</span>
                    <span className="pa-table-date">Pending</span>
                    <button
                      type="button"
                      className="pa-review-btn"
                      onClick={() => openReview(request)}
                    >
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeRequest && (
        <NewCompanyRegistrationModal
          company={{
            name: activeRequest.companyName || activeRequest.fullName || activeRequest.username,
            email: activeRequest.email,
            image: activeRequest.image || null,
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onClose={closeReview}
        />
      )}
    </div>
  );
};

export default RegistrationRequestPage;