import React, { useState } from "react";
import "../styles/BrowseAssetsPage.css";

const initialTenders = [
  {
    id: 1,
    status: "Active",
    statusClass: "status-active",
    category: "VEHICLES - SEDANS",
    title: "2019 Toyota Corolla 1.6 Quest",
    description: "Ex-fleet vehicle in good condition. Full service history available. Mileage: 145,000km.",
    leadingBid: "R 85,000.00",
    buttonClass: "btn-dark",
  },
  {
    id: 2,
    status: "Active",
    statusClass: "status-active",
    category: "SCIENTIFIC",
    title: "Olympus CX23 Upright Microscope",
    description: "Binocular microscope used in undergraduate biology labs. Fully functional, minor cosmetic wear.",
    leadingBid: "R 14,500.00",
    buttonClass: "btn-dark",
  },
  {
    id: 3,
    status: "Closing in 2h",
    statusClass: "status-urgent",
    category: "IT INFRASTRUCTURE",
    title: "Dell PowerEdge R740 Server Batch",
    description: "Lot of 3 decommissioned servers. No HDDs included. RAM and CPUs intact. Sold as a single lot.",
    leadingBid: "R 22,000.00",
    buttonClass: "btn-dark",
  },
  {
    id: 4,
    status: "Active",
    statusClass: "status-active",
    category: "VEHICLES - UTILITY",
    title: "2018 Isuzu D-Max 250 Single Cab",
    description: "Campus maintenance vehicle. Canopy included. Runs perfectly, shows typical work-related wear.",
    leadingBid: "R 115,000.00",
    buttonClass: "btn-dark",
  }
];

function BrowseAssetsPage() {
  const [tenders] = useState(initialTenders);

  return React.createElement(
    "div",
    { className: "browse-page-container" },
    
    // 1. Top Navigation Header
    React.createElement(
      "header",
      { className: "portal-header" },
      React.createElement(
        "div",
        { className: "header-left" },
        React.createElement("div", { className: "logo-placeholder" }, "[Logo] Nelson Mandela University"),
        React.createElement("span", { className: "portal-title" }, "Asset Tender Portal")
      ),
      React.createElement(
        "div",
        { className: "header-right" },
        React.createElement(
          "div",
          { className: "search-bar" },
          React.createElement("span", { className: "search-icon" }, "🔍"),
          React.createElement("input", { type: "text", placeholder: "Search assets..." })
        )
      )
    ),

    // 2. Main Content Section
    React.createElement(
      "main",
      { className: "portal-content" },
      
      // Heading & Sorting UI Row
      React.createElement(
        "div",
        { className: "content-heading-row" },
        React.createElement("h1", null, "All Asset Tenders"),
        React.createElement(
          "div",
          { className: "sort-container" },
          React.createElement("label", { htmlFor: "sort-select" }, "Sort by:"),
          React.createElement(
            "select",
            { id: "sort-select", defaultValue: "closing-soonest" },
            React.createElement("option", { value: "closing-soonest" }, "Closing Date (Soonest)")
          )
        )
      ),

      // 3. Tenders Container Cards List
      React.createElement(
        "div",
        { className: "tenders-list" },
        tenders.map((tender) =>
          React.createElement(
            "div",
            { key: tender.id, className: "tender-card" },
            
            // Card Image Box (Temporary Gray Box Placeholder)
            React.createElement(
              "div",
              { className: "tender-image-placeholder" },
              React.createElement(
                "span",
                { className: `status-badge ${tender.statusClass}` },
                `● ${tender.status}`
              ),
              React.createElement("div", { className: "image-mock-text" }, "No Image Available")
            ),

            // Card Body Details
            React.createElement(
              "div",
              { className: "tender-details" },
              React.createElement("span", { className: "tender-category" }, tender.category),
              React.createElement("h2", { className: "tender-title" }, tender.title),
              React.createElement("p", { className: "tender-description" }, tender.description),
              
              // Card Footer (Bidding Row)
              React.createElement(
                "div",
                { className: "tender-footer-row" },
                React.createElement(
                  "div",
                  { className: "bid-info" },
                  React.createElement("span", { className: "bid-label" }, "Leading Bid"),
                  React.createElement("span", { className: "bid-amount" }, tender.leadingBid)
                ),
                React.createElement(
                  "button",
                  { className: `place-bid-btn ${tender.buttonClass}` },
                  "Place Bid"
                )
              )
            )
          )
        )
      ),

      // 4. Pagination
      React.createElement(
        "div",
        { className: "pagination" },
        React.createElement("button", { className: "page-nav-btn" }, "<"),
        React.createElement("button", { className: "page-num-btn active" }, "1"),
        React.createElement("button", { className: "page-num-btn" }, "2"),
        React.createElement("button", { className: "page-num-btn" }, "3"),
        React.createElement("button", { className: "page-nav-btn" }, ">")
      )
    ),

    // 5. System Global Base Footer Block
    React.createElement(
      "footer",
      { className: "portal-footer" },
      React.createElement("h3", null, "Asset Tender Portal"),
      React.createElement(
        "div",
        { className: "footer-links" },
        React.createElement("a", { href: "#terms" }, "Terms of Use"),
        React.createElement("a", { href: "#privacy" }, "Privacy Policy"),
        React.createElement("a", { href: "#faq" }, "Tender FAQ"),
        React.createElement("a", { href: "#accessibility" }, "Accessibility"),
        React.createElement("a", { href: "#contact" }, "Contact Procurement")
      )
    )
  );
}

export default BrowseAssetsPage;