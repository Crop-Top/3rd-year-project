import React from "react";
import "./SkeletonCard.css";

export function SkeletonCard() {
  return (
    <div className="tender-card skeleton-card">
      <div className="skeleton-image" />
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-category" />
        <div className="skeleton-line skeleton-description" />
        <div className="skeleton-row">
          <div className="skeleton-line skeleton-bid" />
          <div className="skeleton-line skeleton-badge" />
        </div>
      </div>
    </div>
  );
}