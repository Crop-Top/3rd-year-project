import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout, getCurrentUser } from "../services/authService";
import { apiFetch } from "../services/apiClient";
import "../styles/component_style/Sidebar.css";

const DRAG_THRESHOLD = 5;
const CLOSED_X = 0; 
const SIDEBAR_WIDTH = 260; 
const OFFSET_FROM_SIDEBAR = 0; 

function Sidebar({ links = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const dragState = useRef({ dragging: false, moved: false, offsetY: 0 });

  const navigate = useNavigate();

  // AUTH STATE CHECK
  const currentUser = getCurrentUser();
  const isLoggedIn = !!currentUser;
  const isAdminUser = currentUser?.role === "Admin" || currentUser?.role === "SuperAdmin";

  // FETCH PENDING INVOICE COUNT FOR BADGE NOTIFICATION
  useEffect(() => {
    if (!isLoggedIn || !isAdminUser) return;

    const fetchPendingInvoiceCount = async () => {
      try {
        const response = await apiFetch("/api/invoice/pending-count");
        if (response && typeof response.count === "number") {
          setInvoiceCount(response.count);
        }
      } catch (err) {
        // Silently swallow polling errors
      }
    };

    fetchPendingInvoiceCount();
    const interval = setInterval(fetchPendingInvoiceCount, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, isAdminUser]);

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

  const handleLogoutClick = async () => {
    closeSidebar();
    try {
      const success = await logout();
      if (success) {
        navigate("/");
      } else {
        alert("Logout synchronization failed.");
      }
    } catch (err) {
      console.error("Crash inside handleLogoutClick function:", err);
    }
  };

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      dragging: true,
      moved: false,
      offsetY: e.clientY - rect.top,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragState.current.dragging) return;

    const newY = e.clientY - dragState.current.offsetY;

    if (!dragState.current.moved) {
      const dy = Math.abs(newY - position.y);
      if (dy > DRAG_THRESHOLD) {
        dragState.current.moved = true;
      }
    }

    const buttonSize = 44;
    const clampedY = Math.min(Math.max(newY, 0), window.innerHeight - buttonSize);

    setPosition({ y: clampedY });
  };

  const handlePointerUp = (e) => {
    dragState.current.dragging = false;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleToggleClick = () => {
    if (!dragState.current.moved) {
      toggleSidebar();
    }
    dragState.current.moved = false;
  };

  const toggleLeftPosition = isOpen
    ? SIDEBAR_WIDTH + OFFSET_FROM_SIDEBAR
    : CLOSED_X;

  const toggleStyle = {
    left: `${toggleLeftPosition}px`,
    top: `${position.y}px`,
    transition: isDragging ? "none" : "left 0.3s ease-in-out",
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        style={toggleStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleToggleClick}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <span className="sidebar-toggle-bar" />
        <span className="sidebar-toggle-bar" />
        <span className="sidebar-toggle-bar" />
      </button>

      <div
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay-visible" : ""}`}
        onClick={closeSidebar}
      />

      <nav className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Menu</span>
          <button
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <ul className="sidebar-links">
          {links.map((link) => {
            const isInvoiceLink = link.to === "/invoice-requests";

            return (
              <li key={link.to}>
                <Link to={link.to} onClick={closeSidebar} className="sidebar-link-item">
                  <span>{link.label}</span>
                  {isInvoiceLink && invoiceCount > 0 && (
                    <span className="sidebar-badge">{invoiceCount}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {isLoggedIn && (
          <div className="sidebar-logout-container">
            <button className="sidebar-logout-action-btn" onClick={handleLogoutClick}>
              🚪 System Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

export default Sidebar;