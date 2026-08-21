import React from "react";
import { Link } from "react-router-dom";
import "../styles/component_style/portalshell.css";

/**
 * Portalheader
 *
 * The same NMU-branded header used across every page, so each page renders
 * it identically instead of keeping its own slightly-different copy. The
 * logo/title doubles as a link back to the landing page.
 *
 * Props:
 *  - children: optional right-side content (search bar, login form, etc.)
 */
const Portalheader = ({ children }) => {
  return (
    <header className="portal-header">
      <Link to="/admin" className="header-left header-home-link">
        <div className="logo-placeholder">
          <span className="logo-bold">NELSON MANDELA</span>
          <span className="logo-light">UNIVERSITY</span>
        </div>
        <div className="divider-vertical"></div>
        <span className="portal-brand-title">Asset Tender Portal</span>
      </Link>

      {children && <div className="header-right">{children}</div>}
    </header>
  );
};

const PortalheaderS = ({ children }) => {
  return (
    <header className="portal-header">
      <Link to="/browse" className="header-left header-home-link">
        <div className="logo-placeholder">
          <span className="logo-bold">NELSON MANDELA</span>
          <span className="logo-light">UNIVERSITY</span>
        </div>
        <div className="divider-vertical"></div>
        <span className="portal-brand-title">Asset Tender Portal</span>
      </Link>

      {children && <div className="header-right">{children}</div>}
    </header>
  );
};

export default Portalheader;