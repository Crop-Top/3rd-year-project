import React, { useEffect, useState } from "react";
import PortalheaderS from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/staff_style/WinningBidsPage.css";
import { getWinningBids } from "../../services/winningBidsService.js";
import { resolveImageUrl } from "../../services/assetService.js";
import { API_BASE_URL, apiFetch } from "../../services/apiClient.js";

const formatRand = (amount) =>
  `R ${Number(amount || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const initialInvoiceForm = {
  invoiceType: "Individual",
  companyName: "",
  contactPerson: "",
  contactEmail: "",
  orderNumber: "",
  vatNumber: "",
  address: "",
  postalCode: "",
  telephoneNumber: "",
  additionalInformation: "",
};

function WinningBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Action Modal State (Invoice & Payment)
  const [actionModal, setActionModal] = useState({ show: false, type: "", item: null });

  // Notice Details Modal State
  const [noticeModal, setNoticeModal] = useState({ show: false, text: "" });

  // Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState(initialInvoiceForm);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  // Detail View State
  const [selectedTenderDetails, setSelectedTenderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBids() {
      try {
        setLoading(true);
        setLoadError("");
        const data = await getWinningBids();
        if (!cancelled && data) {
          setBids(data);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || "Failed to load winning offers.");
          setBids([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBids();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCardClick = async (id) => {
    if (!id) return;

    try {
      setLoadingDetails(true);
      setDetailsError("");

      const token = localStorage.getItem("token");
      const response = await apiFetch(
        `${API_BASE_URL}/tenders/${id}/details`,
        {
          method: "GET",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to retrieve details (Status: ${response.status})`);
      }

      const data = await response.json();
      setSelectedTenderDetails(data);
    } catch (err) {
      setDetailsError(err.message || "Unable to fetch tender details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const openActionModal = (e, type, item) => {
    e.stopPropagation();
    setInvoiceForm(initialInvoiceForm);
    setInvoiceError("");
    setActionModal({ show: true, type, item });
  };

  const closeActionModal = () => {
    setActionModal({ show: false, type: "", item: null });
    setInvoiceForm(initialInvoiceForm);
    setInvoiceError("");
  };

  const openNoticeModal = (e, text) => {
    e.stopPropagation();
    setNoticeModal({ show: true, text });
  };

  const closeNoticeModal = () => {
    setNoticeModal({ show: false, text: "" });
  };

  const closeDetailsModal = () => {
    setSelectedTenderDetails(null);
    setDetailsError("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInvoiceForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    setInvoiceError("");
    setSubmittingInvoice(true);

    const targetListingId = actionModal.item?.listingId || actionModal.item?.id;
    const vatValue = (invoiceForm.vatNumber || "").trim();

    let finalVatNumber = null;
    if (invoiceForm.invoiceType !== "Non-VAT Registered Company") {
      finalVatNumber = vatValue !== "" ? vatValue : null;
    }

    const payload = {
      listingId: targetListingId,
      invoiceType: invoiceForm.invoiceType,
      companyName: invoiceForm.invoiceType === "Individual" ? null : (invoiceForm.companyName?.trim() || null),
      contactPerson: invoiceForm.contactPerson?.trim() || null,
      contactEmail: invoiceForm.contactEmail?.trim() || null,
      orderNumber: invoiceForm.orderNumber?.trim() || null,
      vatNumber: finalVatNumber,
      address: invoiceForm.address?.trim() || null,
      postalCode: invoiceForm.postalCode?.trim() || null,
      telephoneNumber: invoiceForm.telephoneNumber?.trim() || null,
      additionalInformation: invoiceForm.additionalInformation?.trim() || null,
    };

    try {
      const token = localStorage.getItem("token");
      const response = await apiFetch(`${API_BASE_URL}/Invoice/request`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      alert("Invoice request submitted successfully!");
      closeActionModal();
    } catch (err) {
      setInvoiceError(err.message || "Failed to submit invoice request.");
    } finally {
      setSubmittingInvoice(false);
    }
  };

  return (
    <div className="wb-page">
      <PortalheaderS />

      <main className="wb-main">
        <div className="wb-header">
          <h1>My Winning Offers</h1>
          <p>Track your awarded tenders, payment verification, and collection schedules.</p>
        </div>

        {loading && <p>Loading your winning offers...</p>}
        {loadError && <p style={{ color: "#b91c1c", fontWeight: "bold" }}>{loadError}</p>}
        {!loading && !loadError && bids.length === 0 && (
          <p>You currently have no winning offers.</p>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="wb-list">
            {bids.map((bid) => {
              const lotId = bid.listingId || bid.id;
              const rawCategory = bid.categoryName || bid.category || bid.assetCategory || "";
              const isVehicleCategory =
                rawCategory.toLowerCase().includes("vehicle") ||
                rawCategory.toLowerCase().includes("car");

              const reservePrice =
                bid.startingBid ??
                bid.reservePrice ??
                bid.reserveAmount ??
                bid.startingPrice;

              const isDefaulted = bid.status === "Defaulted" || bid.isDefaulted;
              const dueDate = bid.paymentDueDate || bid.awardDeadline || bid.collectionDeadline || "the specified deadline";

              const fullNotice = `Congratulations, you have won lot nr ${lotId} with ${formatRand(bid.amount)} offer. Please pay at the cashiers using the payment details or make an online payment using the invoice details received when an invoice has been requested. Payment and collection must be done before ${dueDate}, otherwise the item will be forfeited even if payment has been completed.`;

              return (
                <div
                  className="wb-card wb-card-clickable"
                  key={bid.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardClick(lotId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(lotId);
                    }
                  }}
                >
                  <div className="wb-image">
                    <img
                      src={
                        resolveImageUrl(bid.image || bid.imageUrl) ||
                        "https://via.placeholder.com/300x200?text=No+Image"
                      }
                      alt={bid.title}
                    />
                  </div>

                  <div className="wb-info">
                    <div className="wb-top-row">
                      <div>
                        <h3>
                          Lot {lotId}: {bid.title}
                        </h3>
                        <p><strong>SN:</strong> {bid.serial || "N/A"}</p>

                        {isVehicleCategory && reservePrice !== undefined && (
                          <p className="wb-reserve-text">
                            Reserve Price: <strong>{formatRand(reservePrice)}</strong>
                          </p>
                        )}

                        <p>Won Date: {bid.wonDate || "Recent"}</p>
                      </div>

                      <div className="wb-price-section">
                        <span className={`wb-status ${isDefaulted ? "rejected" : "verified"}`}>
                          {isDefaulted ? "Defaulted" : bid.status || "Won"}
                        </span>
                        <small>Winning Offer</small>
                        <h2>{formatRand(bid.amount)}</h2>
                      </div>
                    </div>

                    {isDefaulted ? (
                      <div className="wb-notice-box wb-notice-defaulted">
                        <p className="wb-notice-text">
                          <strong>Order Cancelled:</strong> Payment window expired.
                        </p>
                      </div>
                    ) : (
                      <div className="wb-notice-box wb-notice-won">
                        <p className="wb-notice-text">
                          Congratulations, you have won lot nr <strong>{lotId}</strong> with <strong>{formatRand(bid.amount)}</strong> offer...
                        </p>
                        <button
                          type="button"
                          className="wb-read-more-btn"
                          onClick={(e) => openNoticeModal(e, fullNotice)}
                        >
                          Read More
                        </button>
                      </div>
                    )}

                    <div className="wb-actions">
                      <button
                        type="button"
                        className="wb-btn wb-btn-primary"
                        disabled={isDefaulted}
                        onClick={(e) => openActionModal(e, "Invoice", bid)}
                      >
                        Request Invoice
                      </button>
                      <button
                        type="button"
                        className="wb-btn wb-btn-secondary"
                        disabled={isDefaulted}
                        onClick={(e) => openActionModal(e, "Payment", bid)}
                      >
                        Payment Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Notice Read More Modal */}
      {noticeModal.show && (
        <div className="wb-modal-overlay" onClick={closeNoticeModal}>
          <div className="wb-modal-content wb-notice-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Winning Offer Notice</h3>
            <div className="wb-notice-modal-body">
              {noticeModal.text}
            </div>
            <div className="wb-notice-modal-actions">
              <button type="button" className="wb-btn wb-btn-primary" onClick={closeNoticeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {actionModal.show && (
        <div className="wb-modal-overlay" onClick={closeActionModal}>
          <div
            className="wb-modal-content"
            style={{ maxWidth: actionModal.type === "Invoice" ? "800px" : "500px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {actionModal.type === "Invoice" ? (
              <>
                <h2 style={{ marginBottom: "4px" }}>Request Tax Invoice</h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>
                  Fill out the required billing details for Lot {actionModal.item?.listingId || actionModal.item?.id}.
                </p>

                {invoiceError && (
                  <div style={{ padding: "10px", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "16px", fontSize: "0.875rem" }}>
                    {invoiceError}
                  </div>
                )}

                <form onSubmit={handleInvoiceSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "left" }}>
                  
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Invoice Type *</label>
                    <select
                      name="invoiceType"
                      value={invoiceForm.invoiceType}
                      onChange={handleInputChange}
                      required
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                    >
                      <option value="Individual">Individual</option>
                      <option value="VAT Registered Company">VAT Registered Company</option>
                      <option value="Non-VAT Registered Company">Non-VAT Registered Company</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                      Name of the company {invoiceForm.invoiceType !== "Individual" && "*"}
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      placeholder="e.g. Nelson Mandela University"
                      value={invoiceForm.companyName}
                      onChange={handleInputChange}
                      disabled={invoiceForm.invoiceType === "Individual"}
                      required={invoiceForm.invoiceType !== "Individual"}
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", opacity: invoiceForm.invoiceType === "Individual" ? 0.6 : 1 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Contact person *</label>
                    <input
                      type="text"
                      name="contactPerson"
                      placeholder="e.g. Mr John Doe"
                      value={invoiceForm.contactPerson}
                      onChange={handleInputChange}
                      required
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Contact email *</label>
                    <input
                      type="email"
                      name="contactEmail"
                      placeholder="e.g. example@domain.com"
                      value={invoiceForm.contactEmail}
                      onChange={handleInputChange}
                      required
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Order number</label>
                    <input
                      type="text"
                      name="orderNumber"
                      placeholder="e.g. 123ABC"
                      value={invoiceForm.orderNumber}
                      onChange={handleInputChange}
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>
                      Vat number {invoiceForm.invoiceType === "VAT Registered Company" && "*"}
                    </label>
                    <input
                      type="text"
                      name="vatNumber"
                      placeholder="e.g. 4999999999"
                      value={invoiceForm.vatNumber}
                      onChange={handleInputChange}
                      disabled={invoiceForm.invoiceType === "Non-VAT Registered Company"}
                      required={invoiceForm.invoiceType === "VAT Registered Company"}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        opacity: invoiceForm.invoiceType === "Non-VAT Registered Company" ? 0.6 : 1,
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Address *</label>
                    <textarea
                      name="address"
                      placeholder="e.g. 123 University Way"
                      value={invoiceForm.address}
                      onChange={handleInputChange}
                      required
                      rows={2}
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Postal code *</label>
                    <input
                      type="text"
                      name="postalCode"
                      placeholder="e.g. 6001"
                      value={invoiceForm.postalCode}
                      onChange={handleInputChange}
                      required
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Telephone number *</label>
                    <input
                      type="text"
                      name="telephoneNumber"
                      placeholder="e.g. 0415043443"
                      value={invoiceForm.telephoneNumber}
                      onChange={handleInputChange}
                      required
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "4px" }}>Additional information</label>
                    <textarea
                      name="additionalInformation"
                      placeholder="e.g. Start your invoice by filling all the required fields to get to the next step."
                      value={invoiceForm.additionalInformation}
                      onChange={handleInputChange}
                      rows={2}
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2", display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button type="button" className="wb-btn wb-btn-secondary" onClick={closeActionModal} disabled={submittingInvoice}>
                      Cancel
                    </button>
                    <button type="submit" className="wb-btn wb-btn-primary" disabled={submittingInvoice}>
                      {submittingInvoice ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>

                </form>
              </>
            ) : (
              <>
                <h2>Payment Details</h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "12px" }}>
                  Use the following banking and cost center details to make your payment, then upload your proof below.
                </p>

                <div style={{ margin: "16px 0", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "left" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.9rem" }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem", textTransform: "uppercase" }}>Lot / Tender Number</span>
                      <strong>Lot {actionModal.item?.listingId || actionModal.item?.id}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem", textTransform: "uppercase" }}>Cost Center</span>
                      <strong style={{ color: "#2563eb" }}>6145-4340</strong>
                    </div>
                    <div style={{ gridColumn: "span 2", marginTop: "4px" }}>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.8rem", textTransform: "uppercase" }}>Price Due (Winning Offer)</span>
                      <strong style={{ fontSize: "1.2rem", color: "#0f172a" }}>{formatRand(actionModal.item?.amount)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
                  <button type="button" className="wb-btn wb-btn-secondary" onClick={closeActionModal}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedTenderDetails && (
        <div className="wb-modal-overlay" onClick={closeDetailsModal}>
          <div className="wb-modal-content wb-details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", textAlign: "left" }}>
            <h2>{selectedTenderDetails.title}</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Listing ID: {selectedTenderDetails.listingId} | Asset ID: {selectedTenderDetails.assetId}
            </p>

            <div style={{ margin: "12px 0", padding: "12px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", color: "#166534", fontSize: "0.875rem", lineHeight: "1.4" }}>
              Congratulations, you have won lot nr <strong>{selectedTenderDetails.listingId || selectedTenderDetails.id}</strong> with <strong>{formatRand(selectedTenderDetails.leadingBid || selectedTenderDetails.amount)}</strong> offer. Please pay at the cashiers using the payment details or make an online payment using the invoice details received when an invoice has been requested. Payment and collection must be done before <strong>{selectedTenderDetails.paymentDueDate || selectedTenderDetails.awardDeadline || selectedTenderDetails.collectionDeadline || "the specified deadline"}</strong>, otherwise the item will be forfeited even if payment has been completed.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0" }}>
              <p><strong>Category:</strong> {selectedTenderDetails.categoryName || "N/A"}</p>
              <p><strong>Condition:</strong> {selectedTenderDetails.conditionName || "N/A"}</p>
              <p><strong>Location:</strong> {selectedTenderDetails.location || "N/A"}</p>
              <p><strong>Winning Offer:</strong> {formatRand(selectedTenderDetails.leadingBid || selectedTenderDetails.amount)}</p>
            </div>

            <div style={{ textAlign: "right", marginTop: "1.5rem" }}>
              <button type="button" className="wb-btn wb-btn-primary" onClick={closeDetailsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}

export default WinningBidsPage;