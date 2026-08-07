import React, { useEffect, useState } from "react";
import "../../styles/staff_style/WinningBidsPage.css";
import {
  getWinningBids,
  uploadProofOfPayment,
} from "../../services/winningBidsService.js";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function WinningBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modal & Upload States
  const [activeBidForUpload, setActiveBidForUpload] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          setLoadError(err.message || "Failed to load winning bids.");
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

  const refreshBids = async () => {
    try {
      const data = await getWinningBids();
      if (data) setBids(data);
    } catch (err) {
      setLoadError(err.message || "Failed to refresh bids.");
    }
  };

  const statusClass = (status) => {
    switch (status) {
      case "Pending POP":
        return "wb-status pending";
      case "Processing":
        return "wb-status processing";
      case "Verified":
        return "wb-status verified";
      default:
        return "wb-status";
    }
  };

  const handleActionClick = (bid) => {
    if (bid.status === "Pending POP") {
      setActiveBidForUpload(bid);
      setSelectedFile(null);
      setUploadError("");
    } else if (bid.status === "Verified") {
      alert(`Downloading Release Form for Lot ${bid.id}...`);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Invalid file type. Please select a PDF document.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit.");
      setSelectedFile(null);
      return;
    }

    setUploadError("");
    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !activeBidForUpload) return;

    try {
      setIsSubmitting(true);
      setUploadError("");
      await uploadProofOfPayment(activeBidForUpload.id, selectedFile);

      await refreshBids();
      setActiveBidForUpload(null);
      setSelectedFile(null);
    } catch (err) {
      setUploadError(err.message || "An error occurred during upload.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setActiveBidForUpload(null);
      setSelectedFile(null);
      setUploadError("");
    }
  };

  return (
    <div className="wb-page">
      <main className="wb-main">
        <div className="wb-header">
          <h1>My Winning Bids</h1>
          <p>
            View successfully acquired lots, download official university
            invoices, and submit proof of payment for verification.
          </p>
        </div>

        {loading && <p>Loading your winning bids...</p>}
        {loadError && (
          <p style={{ color: "#b91c1c", fontWeight: "bold" }}>{loadError}</p>
        )}
        {!loading && !loadError && bids.length === 0 && (
          <p>You currently have no winning bids or pending payments.</p>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="wb-list">
            {bids.map((bid) => (
              <div className="wb-card" key={bid.id}>
                <div className="wb-image">
                  <img
                    src={
                      bid.image ||
                      "https://via.placeholder.com/300x200?text=No+Image"
                    }
                    alt={bid.title}
                  />
                </div>

                <div className="wb-info">
                  <div className="wb-top-row">
                    <div>
                      <h3>
                        Lot {bid.id}: {bid.title}
                      </h3>
                      <p>
                        <strong>SN:</strong> {bid.serial}
                      </p>
                      <p>Won: {bid.wonDate}</p>
                    </div>

                    <div className="wb-price-section">
                      <span className={statusClass(bid.status)}>
                        {bid.status}
                      </span>
                      <small>Total Amount</small>
                      <h2>{formatRand(bid.amount)}</h2>
                    </div>
                  </div>

                  <div className="wb-buttons">
                    <button className="wb-secondary">{bid.document}</button>

                    <button
                      type="button"
                      onClick={() => handleActionClick(bid)}
                      className={
                        bid.status === "Verified"
                          ? "wb-success"
                          : bid.status === "Pending POP"
                          ? "wb-primary"
                          : "wb-disabled"
                      }
                      disabled={bid.status === "Processing"}
                    >
                      {bid.action}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* POP Upload Modal */}
      {activeBidForUpload && (
        <div className="wb-modal-overlay" onClick={closeModal}>
          <div
            className="wb-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wb-modal-header">
              <h2>Upload Proof of Payment</h2>
              <button
                type="button"
                className="wb-modal-close"
                onClick={closeModal}
              >
                &times;
              </button>
            </div>

            <p className="wb-modal-subtitle">
              Lot {activeBidForUpload.id}: {activeBidForUpload.title} (Amount:{" "}
              {formatRand(activeBidForUpload.amount)})
            </p>

            <form onSubmit={handleUploadSubmit}>
              <div className="wb-file-dropzone">
                <input
                  type="file"
                  id="popFileInput"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <label htmlFor="popFileInput" className="wb-file-label">
                  <span className="wb-file-icon">📄</span>
                  {selectedFile ? (
                    <span className="wb-file-name">{selectedFile.name}</span>
                  ) : (
                    <span>Click or drag PDF proof of payment here</span>
                  )}
                  <small>Only PDF files up to 5MB are supported</small>
                </label>
              </div>

              {uploadError && (
                <div style={{ color: "#b91c1c", marginTop: "10px" }}>
                  {uploadError}
                </div>
              )}

              <div className="wb-modal-actions">
                <button
                  type="button"
                  className="wb-button-cancel"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wb-button-submit"
                  disabled={!selectedFile || isSubmitting}
                >
                  {isSubmitting ? "Uploading..." : "Submit Proof"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="wb-footer">
        <h3>Asset Tender Portal</h3>
        <div className="wb-footer-links">
          <a href="#terms">Terms of Use</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#faq">Tender FAQ</a>
          <a href="#accessibility">Accessibility</a>
          <a href="#contact">Contact Procurement</a>
        </div>
        <p>
          © 2024 Nelson Mandela University. All Rights Reserved. Asset Disposal
          & Tender Division.
        </p>
      </footer>
    </div>
  );
}

export default WinningBidsPage;