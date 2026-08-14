import React, { useState, useEffect, useCallback } from 'react';
import NewCompanyRegistrationModal from '../../components/NewCompanyRegistrationModal';
import '../../styles/admin_style/RegistrationRequest.css';
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
};

const RegistrationRequestPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRequest, setActiveRequest] = useState(null);

  // Fetch pending registration requests from the database
  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await apiFetch(`${API_BASE_URL}/User?search=Pending&limit=100`);

      if (!res.ok) {
        throw new Error(`Failed to load pending requests (HTTP ${res.status})`);
      }

      const data = await res.json();
      const rawItems = Array.isArray(data) ? data : data?.items || [];

      // Filter strictly for users with 'Pending' status
      const pendingUsers = rawItems.filter(
        (u) => (u.status || u.accountStatus || '').toLowerCase() === 'pending'
      );

      setRequests(pendingUsers);
    } catch (err) {
      console.error('Failed to fetch registration requests:', err);
      setError(err.message || 'Failed to load pending registration requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const openReview = (request) => setActiveRequest(request);
  const closeReview = () => setActiveRequest(null);

  // Approve User -> PUT /api/admin/users/{id}/approve
  const handleApprove = async () => {
    if (!activeRequest) return;
    const targetId = activeRequest.userId || activeRequest.id;

    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/users/${targetId}/approve`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.Message || `Approval failed (HTTP ${res.status})`
        );
      }

      // Remove approved user from the pending list
      setRequests((prev) =>
        prev.filter((r) => (r.userId || r.id) !== targetId)
      );
      closeReview();
    } catch (err) {
      console.error('Approve failed:', err);
      alert(`Failed to approve request: ${err.message}`);
    }
  };

  // Deny User -> PUT /api/admin/users/{id}/deny
  const handleDeny = async () => {
    if (!activeRequest) return;
    const targetId = activeRequest.userId || activeRequest.id;

    try {
      const res = await apiFetch(`${API_BASE_URL}/admin/users/${targetId}/deny`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.Message || `Rejection failed (HTTP ${res.status})`
        );
      }

      // Remove rejected user from the pending list
      setRequests((prev) =>
        prev.filter((r) => (r.userId || r.id) !== targetId)
      );
      closeReview();
    } catch (err) {
      console.error('Deny failed:', err);
      alert(`Failed to decline request: ${err.message}`);
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

          {loading ? (
            <div className="pa-empty-state">
              <p>Loading pending registration requests...</p>
            </div>
          ) : error ? (
            <div className="pa-empty-state">
              <p style={{ color: '#dc2626' }}>⚠️ {error}</p>
              <button
                type="button"
                className="pa-review-btn"
                style={{ marginTop: '12px' }}
                onClick={fetchPendingRequests}
              >
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
                const companyName =
                  request.companyName || request.fullName || request.username;
                const email = request.email;
                const submitted = formatDate(
                  request.createdAt || request.submittedOn
                );

                return (
                  <div className="pa-table-row" key={reqId}>
                    <span className="pa-table-company">{companyName}</span>
                    <span className="pa-table-email">{email}</span>
                    <span className="pa-table-date">{submitted}</span>
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
            name:
              activeRequest.companyName ||
              activeRequest.fullName ||
              activeRequest.username,
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