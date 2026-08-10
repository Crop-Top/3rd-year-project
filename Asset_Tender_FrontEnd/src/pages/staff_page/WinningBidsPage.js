import React, { useState } from "react";
import "../../styles/staff_style/WinningBidsPage.css";
import "../../styles/shared/TenderCard.css";

const formatRand = (amount) =>
  `R${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ==========================================
// DUMMY WINNING BIDS
// ==========================================

const dummyBids = [
  {
    id: 101,
    title: "Office High Back Chair",
    serial: "NMU-CHAIR-001",
    wonDate: "08 August 2026",
    amount: 200.01,
    status: "Pending POP",
    category: "Office Equipment",
    image:
      "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 102,
    title: "2015 Pre-Owned Ford Fiesta",
    serial: "NMU-FORD-2015",
    wonDate: "06 August 2026",
    amount: 60000,
    status: "Processing",
    category: "Motor Vehicle",
    image:
      "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 103,
    title: "Rotary Evaporator",
    serial: "NMU-LAB-003",
    wonDate: "04 August 2026",
    amount: 9000,
    status: "Verified",
    category: "Laboratory Equipment",
    image:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 104,
    title: "Oak Office Bookcase",
    serial: "NMU-FURN-014",
    wonDate: "02 August 2026",
    amount: 625,
    status: "Pending POP",
    category: "Office Furniture",
    image:
      "https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=800&q=80",
  },
];

function WinningBidsPage() {
  const [bids, setBids] = useState(dummyBids);

  // Upload states
  const [activeBidForUpload, setActiveBidForUpload] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

 const getActionButtonText = (status) => {
  switch (status) {
    case "Pending POP":
      return "Upload POP";
    case "Processing":
      return "Processing";
    case "Verified":
      return "Upload POP";
    default:
      return "Action";
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

    if (!selectedFile || !activeBidForUpload) {
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadError("");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setBids((currentBids) =>
        currentBids.map((bid) =>
          bid.id === activeBidForUpload.id
            ? {
                ...bid,
                status: "Processing",
              }
            : bid
        )
      );

      setActiveBidForUpload(null);
      setSelectedFile(null);
    } catch (err) {
      setUploadError("An error occurred while uploading the document.");
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

  const getStatusDotClass = (status) => {
    if (status === "Verified") {
      return "status-dot-active";
    }
    if (status === "Processing") {
      return "status-dot-urgent";
    }
    return "status-dot-pending";
  };

  return (
    <div className="wb-page">
      <main className="wb-main">
        <div className="wb-heading">
          <h1>My Winning Bids</h1>
          <p>
            View successfully acquired lots, download official university
            invoices, and submit proof of payment for verification.
          </p>
        </div>

        <div className="tender-grid">
          {bids.map((bid) => (
            <div className="tender-card" key={bid.id}>
              <div className="tender-image-wrapper">
                {bid.image ? (
                  <img
                    src={bid.image}
                    alt={bid.title}
                    className="tender-image"
                  />
                ) : (
                  <div className="tender-image-fallback">
                    No Image Available
                  </div>
                )}
                <span className="tender-badge">{bid.category}</span>
              </div>

              <div className="tender-content">
                <h2 className="tender-title">{bid.title}</h2>
                <p className="wb-lot-number">Lot {bid.id}</p>

                <p className="tender-description">
                  <strong>Serial:</strong> {bid.serial}
                  <br />
                  <strong>Won:</strong> {bid.wonDate}
                </p>

                <div className="status-line">
                  <span
                    className={`status-dot ${getStatusDotClass(bid.status)}`}
                  />
                  Status: {bid.status}
                </div>

                <div className="tender-footer">
                  <div className="tender-price-container">
                    <p className="tender-label">Winning Bid</p>
                    <p className="tender-price">{formatRand(bid.amount)}</p>
                  </div>

                  <div className="wb-card-actions">
                    <button
                      type="button"
                      className="wb-document-btn"
                      onClick={() =>
                        alert(`Opening Invoice for Lot ${bid.id}...`)
                      }
                    >
                      Invoice
                    </button>

                    <button
                      type="button"
                      className={
                        bid.status === "Verified"
                          ? "wb-success"
                          : bid.status === "Pending POP"
                          ? "wb-primary"
                          : "wb-disabled"
                      }
                      onClick={() => handleActionClick(bid)}
                      disabled={bid.status === "Processing"}
                    >
                      {getActionButtonText(bid.status)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

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
              Lot {activeBidForUpload.id}: {activeBidForUpload.title}
              <br />
              Amount: {formatRand(activeBidForUpload.amount)}
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
                <div className="wb-upload-error">{uploadError}</div>
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