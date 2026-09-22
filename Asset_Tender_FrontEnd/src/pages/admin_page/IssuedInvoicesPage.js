import React, { useEffect, useMemo, useState } from "react";
import {
  attachInvoiceFile,
  downloadInvoiceFile,
  fetchInvoiceFile,
  getInvoicedInvoiceRequests,
  resendInvoice,
} from "../../services/assetService";
import "../../styles/admin_style/InvoiceRequestsPage.css";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA");
};

function IssuedInvoicesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [attachTarget, setAttachTarget] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachSendEmail, setAttachSendEmail] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    loadIssuedInvoices();
  }, []);

  const loadIssuedInvoices = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getInvoicedInvoiceRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to fetch issued invoices.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((item) => {
      const haystack = [
        item.tenderTitle,
        item.companyName,
        item.contactPerson,
        item.contactEmail,
        item.referenceNo,
        item.listingId,
        item.requestId,
        item.fileName,
      ]
        .filter((v) => v != null && v !== "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [requests, searchQuery]);

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

  const isVatRegistered = (invoiceType) => {
    const norm = (invoiceType || "").toLowerCase();
    return norm.includes("vat registered") && !norm.includes("non-vat");
  };

  const closePreview = () => {
    if (preview?.blobUrl) {
      window.URL.revokeObjectURL(preview.blobUrl);
    }
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
  };

  const handleView = async (item) => {
    if (!item.hasInvoiceFile) return;
    if (preview?.blobUrl) {
      window.URL.revokeObjectURL(preview.blobUrl);
    }

    setPreviewLoading(true);
    setPreviewError("");
    setBusyId(item.requestId);
    setPreview({
      listing: item,
      blobUrl: null,
      fileName: null,
      contentType: null,
    });

    try {
      const { blob, fileName, contentType } = await fetchInvoiceFile(item.requestId);
      const blobUrl = window.URL.createObjectURL(blob);
      setPreview({
        listing: item,
        blobUrl,
        fileName,
        contentType,
      });
    } catch (err) {
      setPreviewError(err.message || "Failed to load invoice file.");
    } finally {
      setPreviewLoading(false);
      setBusyId(null);
    }
  };

  const handleDownloadFromPreview = () => {
    if (!preview?.blobUrl || !preview.fileName) return;
    const link = document.createElement("a");
    link.href = preview.blobUrl;
    link.download = preview.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownload = async (item) => {
    try {
      setBusyId(item.requestId);
      setError("");
      await downloadInvoiceFile(item.requestId);
    } catch (err) {
      setError(err.message || "Failed to download invoice.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (item) => {
    if (!item.hasInvoiceFile) return;
    if (
      !window.confirm(
        `Resend the stored invoice to ${item.contactEmail}?`
      )
    ) {
      return;
    }

    try {
      setBusyId(item.requestId);
      setError("");
      const result = await resendInvoice(item.requestId);
      alert(result.message || `Invoice resent to ${item.contactEmail}.`);
    } catch (err) {
      setError(err.message || "Failed to resend invoice.");
    } finally {
      setBusyId(null);
    }
  };

  const openAttach = (item) => {
    setAttachTarget(item);
    setAttachFile(null);
    setAttachSendEmail(false);
    setAttachError("");
  };

  const closeAttach = () => {
    if (attaching) return;
    setAttachTarget(null);
    setAttachFile(null);
    setAttachSendEmail(false);
    setAttachError("");
  };

  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachTarget || !attachFile) {
      setAttachError("Choose a PDF invoice file.");
      return;
    }

    try {
      setAttaching(true);
      setAttachError("");
      setBusyId(attachTarget.requestId);
      await attachInvoiceFile(attachTarget.requestId, attachFile, attachSendEmail);
      setAttachTarget(null);
      setAttachFile(null);
      setAttachSendEmail(false);
      setAttachError("");
      await loadIssuedInvoices();
      alert(
        attachSendEmail
          ? "Invoice file stored and emailed."
          : "Invoice file stored for later retrieval."
      );
    } catch (err) {
      setAttachError(err.message || "Failed to attach invoice file.");
    } finally {
      setAttaching(false);
      setBusyId(null);
    }
  };

  return (
    <div className="invoice-requests-page">
      <Portalheader />

      <main className="invoice-container">
        <h1 className="page-title">Issued Invoices</h1>
        <p className="page-subtitle">
          Retrieve stored invoices for Invoiced requests, download them, or resend
          to the buyer when needed.
        </p>

        <div className="issued-toolbar">
          <input
            type="search"
            className="issued-search"
            placeholder="Search by listing, email, company, or file name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search issued invoices"
          />
        </div>

        {loading && <div className="invoice-loading">Loading issued invoices…</div>}
        {error && <div className="invoice-error-banner">{error}</div>}

        {!loading && !error && filteredRequests.length === 0 && (
          <div className="invoice-empty-state">
            <div className="empty-icon">📄</div>
            <h2>No Issued Invoices</h2>
            <p>
              {requests.length === 0
                ? "No invoice requests have been marked as Invoiced yet."
                : "No issued invoices match your search."}
            </p>
          </div>
        )}

        <div className="invoice-grid">
          {filteredRequests.map((item) => (
            <div key={item.requestId} className="invoice-tile">
              <div className="tile-badge-wrapper">
                <span className={getCategoryBadgeClass(item.invoiceType)}>
                  {item.invoiceType || "INDIVIDUAL"}
                </span>
                <span
                  className={
                    item.hasInvoiceFile
                      ? "status-badge-invoiced"
                      : "status-badge-missing-file"
                  }
                >
                  {item.hasInvoiceFile ? "STORED" : "NO FILE"}
                </span>
              </div>

              <h3 className="tile-title">{item.tenderTitle}</h3>
              <p className="tile-reference">
                Ref: #{item.referenceNo || item.listingId} · Request #{item.requestId}
              </p>

              <div className="tile-details">
                <div className="detail-row">
                  <span className="detail-label">Company / Contact:</span>
                  <span className="detail-value">
                    {item.companyName || item.contactPerson}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{item.contactEmail}</span>
                </div>
                {item.vatNumber && isVatRegistered(item.invoiceType) && (
                  <div className="detail-row">
                    <span className="detail-label">VAT No:</span>
                    <span className="detail-value">{item.vatNumber}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value amount-highlight">
                    {formatRand(item.finalBidAmount)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Issued:</span>
                  <span className="detail-value">
                    {formatDateTime(item.invoicedAt || item.requestedAt)}
                  </span>
                </div>
                {item.fileName && (
                  <div className="detail-row">
                    <span className="detail-label">File:</span>
                    <span className="detail-value">{item.fileName}</span>
                  </div>
                )}
              </div>

              <div className="tile-action-footer issued-actions">
                {item.hasInvoiceFile ? (
                  <>
                    <button
                      type="button"
                      className="generate-invoice-btn"
                      onClick={() => handleView(item)}
                      disabled={busyId !== null}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="issued-btn-secondary"
                      onClick={() => handleDownload(item)}
                      disabled={busyId !== null}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="issued-btn-secondary"
                      onClick={() => handleResend(item)}
                      disabled={busyId !== null}
                    >
                      Resend
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="generate-invoice-btn"
                    onClick={() => openAttach(item)}
                    disabled={busyId !== null}
                  >
                    Attach Invoice
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {preview && (
        <div className="invoice-modal-overlay" onClick={closePreview}>
          <div
            className="invoice-modal invoice-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="issued-invoice-preview-title"
          >
            <div className="modal-header">
              <h2 id="issued-invoice-preview-title">
                Invoice — {preview.listing?.tenderTitle || `#${preview.listing?.requestId}`}
              </h2>
              <button type="button" className="close-modal-btn" onClick={closePreview}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="preview-meta">
                Listing #{preview.listing?.listingId}
                {preview.fileName ? ` · ${preview.fileName}` : ""}
                {preview.listing?.contactEmail
                  ? ` · ${preview.listing.contactEmail}`
                  : ""}
              </p>

              <div className="invoice-preview-body">
                {previewLoading && (
                  <p className="preview-status">Loading invoice…</p>
                )}
                {!previewLoading && previewError && (
                  <p className="preview-error" role="alert">
                    {previewError}
                  </p>
                )}
                {!previewLoading && !previewError && preview.blobUrl && (
                  <>
                    {String(preview.contentType || "")
                      .toLowerCase()
                      .startsWith("image/") ? (
                      <img
                        src={preview.blobUrl}
                        alt="Issued invoice"
                        className="invoice-preview-image"
                      />
                    ) : String(preview.contentType || "")
                        .toLowerCase()
                        .includes("pdf") ? (
                      <iframe
                        title="Issued invoice PDF"
                        src={preview.blobUrl}
                        className="invoice-preview-frame"
                      />
                    ) : (
                      <p className="preview-status">
                        Preview not available for this file type. Use Download
                        instead.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closePreview}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleDownloadFromPreview}
                  disabled={!preview.blobUrl || previewLoading}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {attachTarget && (
        <div className="invoice-modal-overlay" onClick={closeAttach}>
          <div
            className="invoice-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>Attach Invoice — #{attachTarget.requestId}</h2>
              <button type="button" className="close-modal-btn" onClick={closeAttach}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachSubmit} className="modal-body">
              <div className="summary-box">
                <p>
                  <strong>Tender:</strong> {attachTarget.tenderTitle}
                </p>
                <p>
                  <strong>Email:</strong> {attachTarget.contactEmail}
                </p>
                <p>
                  This request was marked Invoiced but has no stored file. Attach
                  the PDF to enable view, download, and resend.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Upload Official Invoice (PDF)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  required
                  className="file-input"
                  disabled={attaching}
                  onChange={(e) => {
                    setAttachFile(e.target.files?.[0] || null);
                    setAttachError("");
                  }}
                />
              </div>

              <label className="attach-email-toggle">
                <input
                  type="checkbox"
                  checked={attachSendEmail}
                  disabled={attaching}
                  onChange={(e) => setAttachSendEmail(e.target.checked)}
                />
                Also email to {attachTarget.contactEmail}
              </label>

              {attachError && (
                <p className="preview-error" role="alert">
                  {attachError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeAttach}
                  disabled={attaching}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={attaching || !attachFile}
                >
                  {attaching ? "Saving…" : "Store Invoice"}
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

export default IssuedInvoicesPage;
