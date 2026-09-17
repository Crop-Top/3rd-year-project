import React, { useState } from "react";
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
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <footer className="portal-footer">
      <h3 className="footer-brand">Asset Tender Portal</h3>
      <div className="footer-links">
        <span onClick={() => navigate("/terms")}>Terms of Use</span>
        <a 
          href="https://www.mandela.ac.za/privacy-statement" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        <span onClick={() => navigate("/faq")}>Tender FAQ</span>
        <span onClick={() => setIsContactModalOpen(true)}>Contact Procurement</span>
      </div>
      <p className="footer-copyright">
        &copy; 2026 Nelson Mandela University. All Rights Reserved. Asset Disposal &amp; Tender Division.
      </p>

      {/* Contact Procurement Popup Modal */}
      {isContactModalOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsContactModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#ffffff",
              padding: "28px 32px",
              borderRadius: "8px",
              maxWidth: "450px",
              width: "90%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              color: "#333333"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#001f3f", fontSize: "20px" }}>Contact Procurement</h3>
              <button 
                onClick={() => setIsContactModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#666666"
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#666666", marginTop: 0, marginBottom: "20px" }}>
              For inquiries regarding tender items, viewing appointments, or asset disposal support:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ color: "#001f3f" }}>General & Technical Queries Email:</strong>
                <a href="mailto:assets@mandela.ac.za" style={{ color: "#2563eb", textDecoration: "underline", marginTop: "2px" }}>
                  assets@mandela.ac.za
                </a>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ color: "#001f3f" }}>Item Viewing & Specification Contact:</strong>
                <span style={{ marginTop: "2px" }}>Siya: <a href="tel:0415042967" style={{ color: "#2563eb", textDecoration: "underline" }}>041 504 2967</a></span>
              </div>
            </div>

            <button 
              onClick={() => setIsContactModalOpen(false)}
              style={{
                marginTop: "24px",
                width: "100%",
                padding: "10px",
                backgroundColor: "#001f3f",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Portalfooter;