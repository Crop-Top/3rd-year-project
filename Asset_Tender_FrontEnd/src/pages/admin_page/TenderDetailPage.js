import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssetById } from "../../services/assetService";
import { getBidsForListing } from "../../services/bidService";
import "../../styles/admin_style/TenderDetailPage.css";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";

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

  // Chart Dimensions
  const viewWidth = 750;
  const viewHeight = 260;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = viewWidth - paddingLeft - paddingRight;
  const chartHeight = viewHeight - paddingTop - paddingBottom;

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
          if (!cancelled) setBids(history || []);
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

  const chartData = useMemo(() => {
    if (!tender?.startTime || bids.length === 0) return [];

    const sortedBids = [...bids].sort(
      (a, b) =>
        new Date(a.submittedAt || a.createdAt || 0) -
        new Date(b.submittedAt || b.createdAt || 0)
    );

    let count = 0;
    const points = [
      { label: formatDateTime(tender.startTime), count: 0 }
    ];

    sortedBids.forEach((bid) => {
      count += 1;
      points.push({
        label: formatDateTime(bid.submittedAt || bid.createdAt),
        count,
      });
    });

    return points;
  }, [bids, tender]);

  const bidCount = bids.length;
  const maxCount = Math.max(bidCount, 5);

  // ALL HOOKS DEFINED BEFORE EARLY RETURNS
  const curvePathD = useMemo(() => {
    if (chartData.length === 0) return "";

    const coords = chartData.map((pt, idx) => ({
      x: paddingLeft + (idx / (chartData.length - 1 || 1)) * chartWidth,
      y: paddingTop + chartHeight - (pt.count / maxCount) * chartHeight,
    }));

    if (coords.length === 1) {
      return `M ${coords[0].x} ${coords[0].y}`;
    }

    return coords.reduce((acc, point, i, a) => {
      if (i === 0) return `M ${point.x},${point.y}`;
      
      const cp1x = a[i - 1].x + (point.x - a[i - 1].x) / 2;
      const cp1y = a[i - 1].y;
      const cp2x = a[i - 1].x + (point.x - a[i - 1].x) / 2;
      const cp2y = point.y;

      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`;
    }, "");
  }, [chartData, chartWidth, chartHeight, paddingLeft, paddingTop, maxCount]);

  // Early returns placed safely AFTER all hook calls
  if (loading) {
    return (
      <div className="tdp-page">
        <Portalheader />
        <div className="tdp-content">
          <p className="tdp-state-msg">Loading tender details...</p>
        </div>
        <Portalfooter />
      </div>
    );
  }

  if (loadError || !tender) {
    return (
      <div className="tdp-page">
        <Portalheader />
        <div className="tdp-content">
          <p className="tdp-state-msg tdp-state-error">
            {loadError || "Tender not found."}
          </p>
          <Link to="/admin" className="tdp-back-link">
            ← Back to Manage Tenders
          </Link>
        </div>
        <Portalfooter />
      </div>
    );
  }

  const progress = progressPercent(tender.startTime, tender.endTime);

  // Y-Axis Ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.round(ratio * maxCount);
    const y = paddingTop + chartHeight - ratio * chartHeight;
    return { value, y };
  });

  return (
    <div className="tdp-page">
      <Portalheader />
      <div className="tdp-content">
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
            <span className="tdp-card-label">Total Bids Placed</span>
            <span className="tdp-card-value">{bidCount}</span>
            {/* <span className="tdp-card-sub">
              {bidCount === 1 ? "1 submission received" : `${bidCount} submissions received`}
            </span> */}
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

        {/* Smooth Growth Curve Section */}
        <div className="tdp-chart-section">
          <div className="tdp-chart-header">
            <h3>Submission Growth</h3>
            <span className="tdp-chart-sub">Cumulative bid count over time</span>
          </div>

          {bidCount === 0 ? (
            <div className="tdp-chart-empty">
              <p>No bidding activity recorded yet.</p>
            </div>
          ) : (
            <div className="tdp-chart-container">
              <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="tdp-svg-chart">
                {/* Horizontal Gridlines & Y-Axis Labels */}
                {yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={paddingLeft}
                      y1={tick.y}
                      x2={paddingLeft + chartWidth}
                      y2={tick.y}
                      stroke="#cbd5e1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingLeft - 10}
                      y={tick.y + 4}
                      fill="#1e293b"
                      fontSize="12"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {tick.value}
                    </text>
                  </g>
                ))}

                {/* X-Axis Line */}
                <line
                  x1={paddingLeft}
                  y1={paddingTop + chartHeight}
                  x2={paddingLeft + chartWidth}
                  y2={paddingTop + chartHeight}
                  stroke="#64748b"
                  strokeWidth="2"
                />

                {/* Y-Axis Line */}
                <line
                  x1={paddingLeft}
                  y1={paddingTop}
                  x2={paddingLeft}
                  y2={paddingTop + chartHeight}
                  stroke="#64748b"
                  strokeWidth="2"
                />

                {/* X-Axis Ticks & Labels */}
                {chartData.map((pt, idx) => {
                  const x = paddingLeft + (idx / (chartData.length - 1 || 1)) * chartWidth;
                  return (
                    <g key={idx}>
                      <line
                        x1={x}
                        y1={paddingTop + chartHeight}
                        x2={x}
                        y2={paddingTop + chartHeight + 6}
                        stroke="#64748b"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={paddingTop + chartHeight + 22}
                        fill="#1e293b"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}

                {/* Smooth Curve Path */}
                <path
                  d={curvePathD}
                  fill="none"
                  stroke="#002b49"
                  strokeWidth="3"
                />

                {/* Data Points */}
                {chartData.map((pt, idx) => {
                  const x = paddingLeft + (idx / (chartData.length - 1 || 1)) * chartWidth;
                  const y = paddingTop + chartHeight - (pt.count / maxCount) * chartHeight;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#002b49"
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
      <Portalfooter />
    </div>
  );
};

export default TenderDetailPage;