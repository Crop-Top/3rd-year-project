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
  const [success, setSuccess] = useState("");
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

      // Filter out items where fileName is null, undefined, or empty
      const validInvoices = Array.isArray(data)
        ? data.filter(
            (item) => item.fileName != null && String(item.fileName).trim() !== ""
          )
        : [];

      setRequests(validInvoices);
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
        item.telephoneNumber,
        item.address,
        item.postalCode,
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

    setSuccess("");
    setError("");
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
      // setSuccess(`Viewing invoice for Tender #${item.listingId}.`);
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
    setSuccess(`Downloaded invoice file "${preview.fileName}".`);
  };

  const handleDownload = async (item) => {
    try {
      setBusyId(item.requestId);
      setError("");
      setSuccess("");
      await downloadInvoiceFile(item.requestId);
      setSuccess(`Invoice downloaded successfully for Request #${item.requestId}.`);
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
      setSuccess("");
      const result = await resendInvoice(item.requestId);
      const msg = result.message || `Invoice resent successfully to ${item.contactEmail}.`;
      setSuccess(msg);
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
      setError("");
      setSuccess("");
      setBusyId(attachTarget.requestId);

      await attachInvoiceFile(attachTarget.requestId, attachFile, attachSendEmail);
      setAttachTarget(null);
      setAttachFile(null);
      setAttachSendEmail(false);
      setAttachError("");
      await loadIssuedInvoices();

      const msg = attachSendEmail
        ? "Invoice file stored and emailed successfully."
        : "Invoice file attached and stored successfully.";
      setSuccess(msg);
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
            placeholder="Search by title, email, company, lot number, or file name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search issued invoices"
          />
        </div>

        {loading && <div className="invoice-loading">Loading issued invoices…</div>}
        {error && <div className="invoice-error-banner" role="alert">{error}</div>}
        {success && (
          <div className="invoice-success-banner" style={{
            backgroundColor: "#d4edda",
            color: "#155724",
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: "1px solid #c3e6cb",
            fontWeight: 500
          }}>
            ✓ {success}
          </div>
        )}

        {!loading && !error && filteredRequests.length === 0 && (
          <div className="invoice-empty-state">
            <div className="empty-icon">📄</div>
            <h2>No Issued Invoices</h2>
            <p>
              {requests.length === 0
                ? "No issued invoices with attached files found."
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

              <h3 className="tile-title">{item.tenderTitle || `Listing #${item.listingId}`}</h3>
              
              <div className="tile-details" style={{ marginTop: "12px" }}>
                {/* 1. Invoice Type */}
                <div className="detail-row">
                  <span className="detail-label">Invoice Type:</span>
                  <span className="detail-value">{item.invoiceType || "—"}</span>
                </div>

                {/* 2. Name of Company (for VAT and Non-VAT registered companies) */}
                <div className="detail-row">
                  <span className="detail-label">Company Name:</span>
                  <span className="detail-value">{item.companyName || "—"}</span>
                </div>

                {/* 3. Contact Person */}
                <div className="detail-row">
                  <span className="detail-label">Contact Person:</span>
                  <span className="detail-value">{item.contactPerson || "—"}</span>
                </div>

                {/* 4. Tel Num */}
                <div className="detail-row">
                  <span className="detail-label">Tel Num:</span>
                  <span className="detail-value">{item.telephoneNumber || "—"}</span>
                </div>

                {/* 5. Postal Code */}
                <div className="detail-row">
                  <span className="detail-label">Postal Code:</span>
                  <span className="detail-value">{item.postalCode || "—"}</span>
                </div>

                {/* 6. Contact Email */}
                <div className="detail-row">
                  <span className="detail-label">Contact Email:</span>
                  <span className="detail-value">{item.contactEmail || "—"}</span>
                </div>

                {/* 7. Address */}
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value" style={{ whitespace: "pre-line" }}>
                    {item.address || "—"}
                  </span>
                </div>

                {/* 8. Lot Number */}
                <div className="detail-row">
                  <span className="detail-label">Lot Number:</span>
                  <span className="detail-value">
                    #{item.listingId || item.listingId || "—"}
                  </span>
                </div>

                {/* Extra Supporting Metadata */}
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
                  <span className="detail-label">Issued Date:</span>
                  <span className="detail-value">
                    {formatDateTime(item.invoicedAt || item.requestedAt)}
                  </span>
                </div>
                {item.fileName && (
                  <div className="detail-row">
                    <span className="detail-label">File Name:</span>
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

      {/* Preview Modal */}
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

      {/* Attach Modal */}
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