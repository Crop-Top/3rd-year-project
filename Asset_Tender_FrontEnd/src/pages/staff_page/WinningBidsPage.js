import React, { useState } from "react";
import "../../styles/staff_style/WinningBidsPage.css";

const MOCK_BIDS = [
  {
    id: 402,
    title: "Executive Desk Set",
    serial: "NMU-F-2023-891",
    wonDate: "12 Oct 2024",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800",
    amount: 4250,
    status: "Pending POP",
    action: "Upload POP",
    document: "Invoice",
  },
  {
    id: 115,
    title: "Dell Latitude Laptops (x5)",
    serial: "Multiple",
    wonDate: "10 Oct 2024",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
    amount: 12500,
    status: "Processing",
    action: "Verifying",
    document: "Receipt",
  },
  {
    id: 89,
    title: "Industrial Printers",
    serial: "HP-IND-22",
    wonDate: "05 Oct 2024",
    image:
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800",
    amount: 2500,
    status: "Verified",
    action: "Release Form",
    document: "Receipt",
  },
];

function WinningBidsPage() {
  const [bids] = useState(MOCK_BIDS);

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

        <div className="wb-list">

          {bids.map((bid) => (
            <div className="wb-card" key={bid.id}>

              <div className="wb-image">
                <img src={bid.image} alt={bid.title} />
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

                    <p>
                      Won: {bid.wonDate}
                    </p>

                  </div>

                  <div className="wb-price-section">

                    <span className={statusClass(bid.status)}>
                      {bid.status}
                    </span>

                    <small>Total Paid</small>

                    <h2>
                      R {bid.amount.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                      })}
                    </h2>

                  </div>

                </div>

                <div className="wb-buttons">

                  <button className="wb-secondary">
                    {bid.document}
                  </button>

                  <button
                    className={
                      bid.status === "Verified"
                        ? "wb-success"
                        : bid.status === "Pending POP"
                        ? "wb-primary"
                        : "wb-disabled"
                    }
                  >
                    {bid.action}
                  </button>

                </div>

              </div>

            </div>
          ))}

        </div>

      </main>

      <footer className="wb-footer">

        <h3>Asset Tender Portal</h3>

        <div className="wb-footer-links">
          <a href="/">Terms of Use</a>
          <a href="/">Privacy Policy</a>
          <a href="/">Tender FAQ</a>
          <a href="/">Accessibility</a>
          <a href="/">Contact Procurement</a>
        </div>

        <p>
          © 2024 Nelson Mandela University. All Rights Reserved.
          Asset Disposal & Tender Division.
        </p>

      </footer>
    </div>
  );
}

export default WinningBidsPage;