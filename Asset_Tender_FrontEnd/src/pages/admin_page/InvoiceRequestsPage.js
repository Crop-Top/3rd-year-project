import React, { useState, useEffect } from "react";
import { getPendingInvoiceRequests, uploadAndSendInvoice } from "../../services/assetService";
import "../../styles/admin_style/InvoiceRequestsPage.css";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";

function InvoiceRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal States
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirmation & Success States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ email: "", lotNumber: "" });

  useEffect(() => {
    loadInvoiceRequests();
  }, []);

  const loadInvoiceRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getPendingInvoiceRequests();
      setRequests(data);
    } catch (err) {
      setError(err.message || "Failed to fetch invoice requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadgeClass = (type) => {
    const norm = (type || "").toLowerCase();
    if (norm.includes("vat registered") && !norm.includes("non-vat")) {
      return "category-badge badge-vat-company";
    }
    if (norm.includes("non-vat")) {
      return "category-badge badge-non-vat-company";
    }
    return "category-badge badge-individual";
  };

  const openIssueModal = (request) => {
    setSelectedRequest(request);
    setInvoiceFile(null);
    setModalError("");
  };

  const closeIssueModal = () => {
    setSelectedRequest(null);
    setInvoiceFile(null);
    setModalError("");
  };

  // Step 1: Trigger confirmation modal
  const handleInitiateSend = (e) => {
    e.preventDefault();
    if (!invoiceFile) {
      setModalError("Please select a PDF invoice file to upload.");
      return;
    }
    setModalError("");
    setShowConfirmModal(true);
  };

  // Step 2: Final API execution on confirmation
  const handleConfirmSubmit = async () => {
    if (!selectedRequest || !invoiceFile) return;

    const lotNum = selectedRequest.lotNumber || selectedRequest.listingId || "N/A";
    const email = selectedRequest.contactEmail;

    try {
      setSubmitting(true);
      setModalError("");
      await uploadAndSendInvoice(selectedRequest.requestId, invoiceFile);

      // Remove item from UI list
      setRequests((prev) => prev.filter((item) => item.requestId !== selectedRequest.requestId));

      // Close modals and display success popup
      setShowConfirmModal(false);
      closeIssueModal();
      setSuccessInfo({ email, lotNumber: lotNum });
      setShowSuccessModal(true);
    } catch (err) {
      setShowConfirmModal(false);
      setModalError(err.message || "Error uploading and sending invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="invoice-requests-page">
      <Portalheader />

      <main className="invoice-container">
        <h1 className="page-title">Pending Invoice Requests</h1>
        <p className="page-subtitle">
          Review request details submitted by winning bidders and attach processed invoices.
        </p>

        {loading && <div className="invoice-loading">Loading database requests...</div>}
        {error && <div className="invoice-error-banner">{error}</div>}

        {!loading && !error && requests.length === 0 && (
          <div className="invoice-empty-state">
            <div className="empty-icon">✓</div>
            <h2>No Pending Invoices</h2>
            <p>All requested invoices have been generated and dispatched.</p>
          </div>
        )}

        <div className="invoice-grid">
          {requests.map((item) => {
            const lotNum = item.lotNumber || item.listingId || "N/A";

            return (
              <div key={item.requestId} className="invoice-tile">
                <div className="tile-badge-wrapper">
                  <span className={getCategoryBadgeClass(item.invoiceType)}>
                    {item.invoiceType || "INDIVIDUAL"}
                  </span>
                  <span className="status-badge-pending">PENDING</span>
                </div>

                <h3 className="tile-title">{item.tenderTitle}</h3>
                {/* <p className="tile-reference">Ref: #{item.referenceNo || item.listingId}</p> */}

                {/* NEATLY STACKED DETAILS */}
                <div className="tile-details" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                  <div className="detail-row">
                    <span className="detail-label">Invoice Type:</span>
                    <span className="detail-value">{item.invoiceType || "Individual"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Lot Number:</span>
                    <span className="detail-value" style={{ fontWeight: "700", color: "#2563eb" }}>
                      #{lotNum}
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Company Name:</span>
                    <span className="detail-value">{item.companyName || "N/A"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Contact Person:</span>
                    <span className="detail-value">{item.contactPerson || "N/A"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Tel Num:</span>
                    <span className="detail-value">{item.telephoneNumber || "N/A"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Contact Email:</span>
                    <span className="detail-value">{item.contactEmail || "N/A"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Postal Code:</span>
                    <span className="detail-value">{item.postalCode || "N/A"}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Address:</span>
                    <span className="detail-value">{item.address || "N/A"}</span>
                  </div>

                  {item.vatNumber && (
                    <div className="detail-row">
                      <span className="detail-label">VAT No:</span>
                      <span className="detail-value">{item.vatNumber}</span>
                    </div>
                  )}

                  {item.orderNumber && (
                    <div className="detail-row">
                      <span className="detail-label">PO Number:</span>
                      <span className="detail-value">{item.orderNumber}</span>
                    </div>
                  )}

                  <div className="detail-row" style={{ marginTop: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                    <span className="detail-label">Final Amount:</span>
                    <span className="detail-value amount-highlight">
                      R {Number(item.finalBidAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="tile-action-footer" style={{ marginTop: "16px" }}>
                  <button className="generate-invoice-btn" onClick={() => openIssueModal(item)}>
                    Attach & Issue Invoice
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* UPLOAD & ISSUE INVOICE MODAL */}
      {selectedRequest && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal" style={{ maxWidth: "600px", width: "100%" }}>
            <div className="modal-header">
              <h2>Issue Invoice - Request #{selectedRequest.requestId}</h2>
              <button className="close-modal-btn" onClick={closeIssueModal}>✕</button>
            </div>

            <form onSubmit={handleInitiateSend} className="modal-body">
              {modalError && (
                <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "14px", fontSize: "0.875rem" }}>
                  {modalError}
                </div>
              )}

              {/* COMPLETE STACKED SUMMARY BOX */}
              <div className="summary-box" style={{ display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: 0 }}><strong>Invoice Type:</strong> {selectedRequest.invoiceType || "Individual"}</p>
                <p style={{ margin: 0 }}><strong>Lot Number:</strong> #{selectedRequest.lotNumber || selectedRequest.listingId || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Company Name:</strong> {selectedRequest.companyName || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Contact Person:</strong> {selectedRequest.contactPerson || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Tel Num:</strong> {selectedRequest.telephoneNumber || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Contact Email:</strong> {selectedRequest.contactEmail || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Postal Code:</strong> {selectedRequest.postalCode || "N/A"}</p>
                <p style={{ margin: 0 }}><strong>Address:</strong> {selectedRequest.address || "N/A"}</p>
                
                {selectedRequest.vatNumber && <p style={{ margin: 0 }}><strong>VAT Number:</strong> {selectedRequest.vatNumber}</p>}
                {selectedRequest.orderNumber && <p style={{ margin: 0 }}><strong>PO Number:</strong> {selectedRequest.orderNumber}</p>}
                {selectedRequest.additionalInformation && <p style={{ margin: 0 }}><strong>Notes:</strong> {selectedRequest.additionalInformation}</p>}
              </div>

              <div className="form-group" style={{ marginTop: "16px" }}>
                <label className="form-label" style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Upload Official Invoice (PDF) *
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setInvoiceFile(e.target.files[0])}
                  className="file-input"
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-cancel" onClick={closeIssueModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Proceed to Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && selectedRequest && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "16px",
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div 
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.2rem", color: "#0f172a" }}>
              Confirm Invoice Dispatch
            </h3>
            <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: "1.5", margin: "0 0 20px 0" }}>
              Are you sure you want to upload and send this invoice for <strong>Lot Number #{selectedRequest.lotNumber || selectedRequest.listingId}</strong> to <strong>{selectedRequest.contactEmail}</strong>?
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontWeight: "600",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Uploading & Sending..." : "Yes, Upload & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {showSuccessModal && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: "16px",
          }}
          onClick={() => setShowSuccessModal(false)}
        >
          <div 
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              width: "100%",
              maxWidth: "420px",
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: "#dcfce7",
                color: "#16a34a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: "bold",
                margin: "0 auto 16px auto",
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", color: "#0f172a" }}>
              Invoice Issued Successfully!
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 24px 0", lineHeight: "1.5" }}>
              The invoice for <strong>Lot Number #{successInfo.lotNumber}</strong> has been uploaded and emailed to <strong>{successInfo.email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "0.95rem",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <Portalfooter />
    </div>
  );
}

export default InvoiceRequestsPage;