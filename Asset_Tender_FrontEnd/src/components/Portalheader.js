import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/component_style/portalshell.css";

const Portalfooter = () => {
  const navigate = useNavigate();

  // Quick Key Shortcut: Press 'Alt + H' from any page to return home
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        navigate("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <footer className="portal-footer">
      <div className="footer-content">
        <Link to="/" className="footer-left footer-home-link" title="Return to Home (Alt + H)">
          <div className="logo-placeholder">
            <span className="logo-bold">NELSON MANDELA</span>
            <span className="logo-light">UNIVERSITY</span>
          </div>
          <div className="divider-vertical"></div>
          <span className="portal-brand-title">Asset Tender Portal</span>
        </Link>

        <div className="footer-right">
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} Nelson Mandela University. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Portalfooter;