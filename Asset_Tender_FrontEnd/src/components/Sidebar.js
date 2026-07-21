import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../services/authService"; 
import "../styles/component_style/Sidebar.css";

const DRAG_THRESHOLD = 5; 

function Sidebar({ links = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 }); 
  const dragState = useRef({ dragging: false, moved: false, offsetX: 0, offsetY: 0 });
  
  const navigate = useNavigate();

  // AUTH STATE CHECK: Check if an access token exists in your application memory.
  // (Replace this line with your actual token getter if your variable is exported differently)
  const isLoggedIn = true; // Temporary flag — swap with: !!window.__accessToken or your state selector

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

  const handleLogoutClick = async () => {
    console.log("Button clicked! Attempting to close sidebar...");
    closeSidebar();
    
    try {
      console.log("Calling logout service function...");
      const success = await logout();
      console.log("Logout service response status:", success);
      
      if (success) {
        console.log("Success! Redirecting back home...");
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
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragState.current.dragging) return;

    const newX = e.clientX - dragState.current.offsetX;
    const newY = e.clientY - dragState.current.offsetY;

    if (!dragState.current.moved) {
      const dx = Math.abs(newX - position.x);
      const dy = Math.abs(newY - position.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        dragState.current.moved = true;
      }
    }

    const buttonSize = 44;
    const clampedX = Math.min(Math.max(newX, 0), window.innerWidth - buttonSize);
    const clampedY = Math.min(Math.max(newY, 0), window.innerHeight - buttonSize);

    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e) => {
    dragState.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleToggleClick = () => {
    if (!dragState.current.moved) {
      toggleSidebar();
    }
    dragState.current.moved = false;
  };

  return (
    <>
      {/* Toggle button — draggable anywhere */}
      <button
        className="sidebar-toggle"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
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

      {/* Dimmed backdrop */}
      <div
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay-visible" : ""}`}
        onClick={closeSidebar}
      />

      {/* The sliding panel itself */}
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
          {links.map((link) => (
            <li key={link.to}>
              <Link to={link.to} onClick={closeSidebar}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CONDITIONALLY RENDER LOGOUT BLOCK ONLY WHEN LOGGED IN */}
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