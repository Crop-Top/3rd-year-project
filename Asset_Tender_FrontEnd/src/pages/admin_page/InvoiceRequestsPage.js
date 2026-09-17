import React, { useState, useEffect } from "react";
import { getPendingInvoiceRequests, uploadAndSendInvoice } from "../../services/assetService";
import "../../styles/admin_style/InvoiceRequestsPage.css";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";

function InvoiceRequestsPage() {
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

  return (
    <div className="invoice-requests-page">
      <Portalheader />

      <main className="invoice-container">
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
              {/* Header with ENTITY TYPE on LEFT and PENDING on RIGHT */}
              <div className="tile-badge-wrapper">
                <span className={getCategoryBadgeClass(item.invoiceType)}>
                  {item.invoiceType || "INDIVIDUAL"}
                </span>
                <span className="status-badge-pending">PENDING</span>
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
                  <span className="detail-value amount-highlight">
                    R {Number(item.finalBidAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="tile-action-footer">
                <button className="generate-invoice-btn" onClick={() => setSelectedRequest(item)}>
                  Attach & Issue Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {selectedRequest && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <div className="modal-header">
              <h2>Issue Invoice - #{selectedRequest.requestId}</h2>
              <button className="close-modal-btn" onClick={() => setSelectedRequest(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="modal-body">
              <div className="summary-box">
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
                <button type="button" className="btn-cancel" onClick={() => setSelectedRequest(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? "Processing..." : "Send to Recipient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Portalfooter />
    </div>
  );
}

export default InvoiceRequestsPage;