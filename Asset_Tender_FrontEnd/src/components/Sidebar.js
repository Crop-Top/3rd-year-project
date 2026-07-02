import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/Sidebar.css";

const DRAG_THRESHOLD = 5; // px of movement before a click counts as a drag

function Sidebar({ links = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 }); // top-left start
  const dragState = useRef({ dragging: false, moved: false, offsetX: 0, offsetY: 0 });

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

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

    // Mark as a real drag once it moves past the threshold
    if (!dragState.current.moved) {
      const dx = Math.abs(newX - position.x);
      const dy = Math.abs(newY - position.y);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        dragState.current.moved = true;
      }
    }

    // Keep the button fully within the viewport
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
    // Only toggle the sidebar if this was a click, not the end of a drag
    if (!dragState.current.moved) {
      toggleSidebar();
    }
    dragState.current.moved = false;
  };

  return (
    <>
      {/* Toggle button — draggable anywhere on screen, click still opens/closes the sidebar */}
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

      {/* Dimmed backdrop, click to close */}
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
      </nav>
    </>
  );
}

export default Sidebar;