import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/component_style/portalshell.css";

/**
 * Portalfooter
 *
 * The same footer used across every page. Full-width and box-sized in
 * portalshell.css rather than relying on each individual page's own
 * container padding — that mismatch was the root cause of the footer not
 * reaching the edge of the browse page.
 */
const Portalfooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="portal-footer">
      <h3 className="footer-brand">Asset Tender Portal</h3>
      <div className="footer-links">
        <span onClick={() => navigate("/terms")}>Terms of Use</span>
        <span onClick={() => navigate("/privacy")}>Privacy Policy</span>
        <span onClick={() => navigate("/faq")}>Tender FAQ</span>
        <span onClick={() => navigate("/accessibility")}>Accessibility</span>
        <span onClick={() => navigate("/contact")}>Contact Procurement</span>
      </div>
      <p className="footer-copyright">
        &copy; 2026 Nelson Mandela University. All Rights Reserved. Asset Disposal &amp; Tender Division.
      </p>
    </footer>
  );
};

export default Portalfooter;