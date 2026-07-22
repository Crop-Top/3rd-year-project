import React from 'react';
import AdminLayout from './AdminLayout';
import '../../styles/admin_style/TenderDetailPage.css';

const BID_HISTORY = [
  { id: 1, bidder: 'Campus Fleet Services, Inc.', bidId: 'BID-992-A', date: 'Oct 29, 2023', time: '10:45 AM', amount: '$14,500.00', status: 'Leading' },
  { id: 2, bidder: 'Metro Auto Remarketing', bidId: 'BID-845-B', date: 'Oct 28, 2023', time: '03:20 PM', amount: '$14,200.00', status: 'Outbid' },
  { id: 3, bidder: 'Apex Vehicles LLC', bidId: 'BID-711-C', date: 'Oct 28, 2023', time: '11:15 AM', amount: '$13,850.00', status: 'Outbid' },
  { id: 4, bidder: 'Campus Fleet Services, Inc.', bidId: 'BID-602-A', date: 'Oct 27, 2023', time: '09:00 AM', amount: '$13,500.00', status: 'Outbid' },
];

const statusClass = (status) =>
  status === 'Leading' ? 'tdp-status tdp-status-leading' : 'tdp-status tdp-status-outbid';

const TenderDetailPage = () => {
  return (
    <AdminLayout pageLabel="Manage Tender Details">
      <div className="tdp-header-row">
        <div className="tdp-header-left">
          <div className="tdp-badge-row">
            <span className="tdp-tender-id">TENDER #A-8924</span>
            <span className="tdp-status-pill">
              <span className="tdp-status-dot" /> Active
            </span>
          </div>
          <h1 className="tdp-title">2019 Toyota Corolla SE</h1>
          <span className="tdp-location">📍 Main Campus Motor Pool</span>
        </div>
        <button type="button" className="tdp-edit-btn">✎ Edit Listing</button>
      </div>

      <div className="tdp-cards-row">
        <div className="tdp-card">
          <span className="tdp-card-label">◒ Current Leading Bid</span>
          <span className="tdp-card-value">$14,500.00</span>
          <span className="tdp-card-sub">
            by <strong>Campus Fleet Services, Inc.</strong>
          </span>
          <div className="tdp-card-footer">
            <span className="tdp-reserve-met">Reserve Met</span>
            <span className="tdp-check">✓</span>
          </div>
        </div>

        <div className="tdp-card">
          <span className="tdp-card-label">⏱ Time Remaining</span>
          <span className="tdp-card-value">2d 14h 45m</span>
          <div className="tdp-progress-track">
            <div className="tdp-progress-fill" style={{ width: '72%' }} />
          </div>
          <div className="tdp-dates-row">
            <div>
              <span className="tdp-dates-label">STARTS</span>
              <span className="tdp-dates-value">Oct 24, 08:00 AM</span>
            </div>
            <div>
              <span className="tdp-dates-label">ENDS</span>
              <span className="tdp-dates-value">Nov 01, 05:00 PM</span>
            </div>
          </div>
        </div>

        <div className="tdp-card">
          <div className="tdp-asset-header">
            <span className="tdp-card-label">Asset Details</span>
            <span className="tdp-expand-icon">⤢</span>
          </div>
          <div className="tdp-asset-placeholder">🚗</div>
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">Condition</span>
            <span className="tdp-asset-value">Good - Operational</span>
          </div>
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">Mileage</span>
            <span className="tdp-asset-value">64,230 mi</span>
          </div>
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">VIN</span>
            <span className="tdp-asset-value">2T1BURHE1KCXXXXXX</span>
          </div>
        </div>
      </div>

      <div className="tdp-bottom-row">
        <div className="tdp-bid-history">
          <div className="tdp-bid-history-header">
            <span className="tdp-bid-history-title">⚑ Bid History <span className="tdp-bid-count">12 Bids</span></span>
            <button type="button" className="tdp-export-btn">⭳ Export</button>
          </div>

          <div className="tdp-table-head">
            <span>BIDDER</span>
            <span>DATE &amp; TIME</span>
            <span>AMOUNT</span>
            <span>STATUS</span>
          </div>

          {BID_HISTORY.map((bid) => (
            <div className="tdp-table-row" key={bid.id}>
              <span className="tdp-bidder-cell">
                <span className="tdp-bidder-name">{bid.bidder}</span>
                <span className="tdp-bidder-id">{bid.bidId}</span>
              </span>
              <span className="tdp-datetime-cell">
                <span>{bid.date}</span>
                <span className="tdp-time">{bid.time}</span>
              </span>
              <span className="tdp-amount-cell">{bid.amount}</span>
              <span className={statusClass(bid.status)}>{bid.status}</span>
            </div>
          ))}

          <div className="tdp-view-all">
            <a href="#view-all-bids">View All 12 Bids</a>
          </div>
        </div>

        <div className="tdp-admin-actions">
          <span className="tdp-admin-actions-title">Admin Actions</span>
          <button type="button" className="tdp-action-btn">Extend Tender ↻</button>
          <button type="button" className="tdp-action-btn">Message Bidders ✉</button>
          <button type="button" className="tdp-action-btn tdp-action-btn-danger">Close Tender Early ⊗</button>
          <button type="button" className="tdp-audit-log-btn">View Audit Log ↺</button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default TenderDetailPage;