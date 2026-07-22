import React, { useState } from 'react';

import "../../styles/admin_style/RegistrationRequest.css";

const MOCK_REQUESTS = [
  {
    id: 1,
    name: 'Apex Logistics Global',
    email: 'registrations@apexlogistics.co',
    image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600',
    submittedOn: 'Jul 18, 2026',
  },
  {
    id: 2,
    name: 'Harbor Freight Solutions',
    email: 'admin@harborfreight.co.za',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600',
    submittedOn: 'Jul 15, 2026',
  },
  {
    id: 3,
    name: 'Karoo Transport Co.',
    email: 'contact@karootransport.co.za',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600',
    submittedOn: 'Jul 11, 2026',
  },
];

const RegistrationRequestPage = () => {
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [activeRequest, setActiveRequest] = useState(null);

  const openReview = (request) => setActiveRequest(request);
  const closeReview = () => setActiveRequest(null);

  const handleApprove = () => {
    setRequests((prev) => prev.filter((r) => r.id !== activeRequest.id));
    closeReview();
  };

  const handleDeny = () => {
    setRequests((prev) => prev.filter((r) => r.id !== activeRequest.id));
    closeReview();
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

          {requests.length === 0 ? (
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

              {requests.map((request) => (
                <div className="pa-table-row" key={request.id}>
                  <span className="pa-table-company">{request.name}</span>
                  <span className="pa-table-email">{request.email}</span>
                  <span className="pa-table-date">{request.submittedOn}</span>
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

      {/* {activeRequest && (
        <NewCompanyRegistrationModal
          company={{
            name: activeRequest.name,
            email: activeRequest.email,
            image: activeRequest.image,
          }}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onClose={closeReview}
        />
      )} */}
    </div>
  );
};

export default RegistrationRequestPage;