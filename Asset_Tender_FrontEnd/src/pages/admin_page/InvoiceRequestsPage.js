import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPendingInvoiceRequests, uploadAndSendInvoice } from "../../services/assetService"; // Adjust path to your service file
import "../../styles/admin_style/InvoiceRequestsPage.css";

function InvoiceRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !invoiceFile) return;

    try {
      setSubmitting(true);
      
      await uploadAndSendInvoice(selectedRequest.requestId, invoiceFile);

      alert(`Invoice successfully issued and emailed to ${selectedRequest.contactEmail}!`);
      
      setRequests((prev) => prev.filter((item) => item.requestId !== selectedRequest.requestId));
      setSelectedRequest(null);
      setInvoiceFile(null);
    } catch (err) {
      alert(`Error sending invoice: ${err.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="invoice-requests-page">
      <main className="invoice-container">
        <button className="back-btn" onClick={() => navigate("/admin")}>
          ← Back to Dashboard
        </button>
        <h1 className="page-title">Pending Invoice Requests</h1>
        <p className="page-subtitle">Review request details submitted by winning bidders and attach processed invoices.</p>

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
          {requests.map((item) => (
            <div key={item.requestId} className="invoice-tile">
              <div className="tile-top">
                <span className="category-badge">{item.invoiceType || "Standard"}</span>
                <span className="status-badge">Pending</span>
              </div>

              <h3 className="tile-title">{item.tenderTitle}</h3>
              <p className="tile-reference">Ref: #{item.referenceNo || item.listingId}</p>

              <div className="tile-details">
                <div className="detail-row">
                  <span className="detail-label">Company / Contact:</span>
                  <span className="detail-value">{item.companyName || item.contactPerson}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{item.contactEmail}</span>
                </div>
                {item.orderNumber && (
                  <div className="detail-row">
                    <span className="detail-label">PO Number:</span>
                    <span className="detail-value">{item.orderNumber}</span>
                  </div>
                )}
                {item.vatNumber && (
                  <div className="detail-row">
                    <span className="detail-label">VAT No:</span>
                    <span className="detail-value">{item.vatNumber}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value highlight-price">
                    R {Number(item.finalBidAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button className="process-invoice-btn" onClick={() => setSelectedRequest(item)}>
                Attach & Issue Invoice
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Upload Modal */}
      {selectedRequest && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <div className="modal-header">
              <h2>Issue Invoice - #{selectedRequest.requestId}</h2>
              <button className="close-btn" onClick={() => setSelectedRequest(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="modal-body">
              <div className="summary-card">
                <p><strong>Target Email:</strong> {selectedRequest.contactEmail}</p>
                <p><strong>Billing Address:</strong> {selectedRequest.address}, {selectedRequest.postalCode}</p>
                {selectedRequest.additionalInformation && (
                  <p><strong>Notes:</strong> {selectedRequest.additionalInformation}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Upload Official Invoice (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setInvoiceFile(e.target.files[0])}
                  className="file-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setSelectedRequest(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Processing..." : "Send to Recipient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceRequestsPage;