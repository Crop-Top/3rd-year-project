import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { getAssetById } from "../../services/assetService";
import { getBidsForListing } from "../../services/bidService";
import "../../styles/admin_style/TenderDetailPage.css";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateParts(value) {
  if (!value) return { date: "—", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function getTimeRemaining(endsAt) {
  const total = Math.max(0, endsAt.getTime() - Date.now());
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  return { total, days, hours, minutes };
}

function formatCountdown({ total, days, hours, minutes }) {
  if (total <= 0) return "Ended";
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function progressPercent(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

const statusClass = (isLeading) =>
  isLeading ? "tdp-status tdp-status-leading" : "tdp-status tdp-status-outbid";

const TenderDetailPage = () => {
  const { listingId } = useParams();
  const [tender, setTender] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    total: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!listingId) {
        setLoadError("No tender specified.");
        setTender(null);
        setBids([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError("");
        const row = await getAssetById(listingId);
        if (cancelled) return;
        if (!row) {
          setTender(null);
          setBids([]);
          setLoadError("Tender not found or not available.");
          return;
        }
        setTender(row);
        try {
          const history = await getBidsForListing(row.listingId);
          if (!cancelled) setBids(history);
        } catch {
          if (!cancelled) setBids([]);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load tender.");
          setTender(null);
          setBids([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const auctionEndsAt = useMemo(() => {
    if (!tender?.endTime) return null;
    return new Date(tender.endTime);
  }, [tender]);

  useEffect(() => {
    if (!auctionEndsAt) return;
    setTimeLeft(getTimeRemaining(auctionEndsAt));
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(auctionEndsAt));
    }, 30_000);
    return () => clearInterval(timer);
  }, [auctionEndsAt]);

  if (loading) {
    return (
      <AdminLayout pageLabel="Manage Tender Details">
        <p className="tdp-state-msg">Loading tender details...</p>
      </AdminLayout>
    );
  }

  if (loadError || !tender) {
    return (
      <AdminLayout pageLabel="Manage Tender Details">
        <p className="tdp-state-msg tdp-state-error">
          {loadError || "Tender not found."}
        </p>
        <Link to="/admin" className="tdp-back-link">
          ← Back to Manage Tenders
        </Link>
      </AdminLayout>
    );
  }

  const leadingBid = tender.leadingBid ?? tender.startingBid ?? 0;
  const leadingBidder =
    bids.find((b) => b.isLeading)?.bidderDisplayName ||
    (bids.length === 0 ? "No bids yet" : "—");
  const reserveMet =
    Number(leadingBid) >= Number(tender.startingBid || 0) && bids.length > 0;
  const progress = progressPercent(tender.startTime, tender.endTime);

  return (
    <AdminLayout pageLabel="Manage Tender Details">
      <div className="tdp-header-row">
        <div className="tdp-header-left">
          <div className="tdp-badge-row">
            <span className="tdp-tender-id">TENDER #{tender.listingId}</span>
            <span className="tdp-status-pill">
              <span className="tdp-status-dot" />
              {tender.status || "Active"}
            </span>
          </div>
          <h1 className="tdp-title">{tender.title}</h1>
          <span className="tdp-location">
            {tender.department || "Nelson Mandela University"}
          </span>
        </div>
        <Link to="/admin" className="tdp-back-btn">
          ← Back
        </Link>
      </div>

      <div className="tdp-cards-row">
        <div className="tdp-card">
          <span className="tdp-card-label">Current Leading Bid</span>
          <span className="tdp-card-value">{formatRand(leadingBid)}</span>
          <span className="tdp-card-sub">
            by <strong>{leadingBidder}</strong>
          </span>
          <div className="tdp-card-footer">
            {bids.length > 0 ? (
              <>
                <span className="tdp-reserve-met">
                  {reserveMet ? "Above starting bid" : "Below starting bid"}
                </span>
                {reserveMet && <span className="tdp-check">✓</span>}
              </>
            ) : (
              <span className="tdp-reserve-met">
                Starting bid {formatRand(tender.startingBid)}
              </span>
            )}
          </div>
        </div>

        <div className="tdp-card">
          <span className="tdp-card-label">Time Remaining</span>
          <span className="tdp-card-value">{formatCountdown(timeLeft)}</span>
          <div className="tdp-progress-track">
            <div
              className="tdp-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="tdp-dates-row">
            <div>
              <span className="tdp-dates-label">STARTS</span>
              <span className="tdp-dates-value">
                {formatDateTime(tender.startTime)}
              </span>
            </div>
            <div>
              <span className="tdp-dates-label">ENDS</span>
              <span className="tdp-dates-value">
                {formatDateTime(tender.endTime)}
              </span>
            </div>
          </div>
        </div>

        <div className="tdp-card">
          <div className="tdp-asset-header">
            <span className="tdp-card-label">Asset Details</span>
          </div>
          {tender.image ? (
            <div className="tdp-asset-image-wrap">
              <img
                src={tender.image}
                alt={tender.title}
                className="tdp-asset-image"
              />
            </div>
          ) : (
            <div className="tdp-asset-placeholder">No image</div>
          )}
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">Condition</span>
            <span className="tdp-asset-value">
              {tender.conditionGrade || "—"}
            </span>
          </div>
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">Category</span>
            <span className="tdp-asset-value">{tender.category || "—"}</span>
          </div>
          <div className="tdp-asset-row">
            <span className="tdp-asset-key">Barcode</span>
            <span className="tdp-asset-value">{tender.barcode || "—"}</span>
          </div>
          {tender.description &&
            tender.description !== "No description provided." && (
              <div className="tdp-asset-row tdp-asset-notes">
                <span className="tdp-asset-key">Notes</span>
                <span className="tdp-asset-value">{tender.description}</span>
              </div>
            )}
        </div>
      </div>

      <div className="tdp-bottom-row tdp-bottom-row-single">
        <div className="tdp-bid-history">
          <div className="tdp-bid-history-header">
            <span className="tdp-bid-history-title">
              Bid History{" "}
              <span className="tdp-bid-count">
                {bids.length} Bid{bids.length === 1 ? "" : "s"}
              </span>
            </span>
          </div>

          <div className="tdp-table-head">
            <span>BIDDER</span>
            <span>DATE &amp; TIME</span>
            <span>AMOUNT</span>
            <span>STATUS</span>
          </div>

          {bids.length === 0 ? (
            <div className="tdp-empty-bids">No bids placed yet.</div>
          ) : (
            bids.map((bid) => {
              const parts = formatDateParts(bid.bidTimestamp);
              return (
                <div className="tdp-table-row" key={bid.bidId}>
                  <span className="tdp-bidder-cell">
                    <span className="tdp-bidder-name">
                      {bid.bidderDisplayName}
                    </span>
                    <span className="tdp-bidder-id">BID-{bid.bidId}</span>
                  </span>
                  <span className="tdp-datetime-cell">
                    <span>{parts.date}</span>
                    <span className="tdp-time">{parts.time}</span>
                  </span>
                  <span className="tdp-amount-cell">
                    {formatRand(bid.bidAmount)}
                  </span>
                  <span className={statusClass(bid.isLeading)}>
                    {bid.isLeading ? "Leading" : "Outbid"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default TenderDetailPage;
