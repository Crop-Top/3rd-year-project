import React, { useState } from "react";
import "../styles/BrowseAssetsPage.css";
// IMPORT YOUR AUTH SERVICE ACTIONS HERE
import { fetchSecureUsersList, serviceTriggerSilentRefresh } from "../services/authService";

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
  
  // NEW STATE: Tracks fetched db items and loading states for your buttons
  const [dbUsers, setDbUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // ACTION: Calls the protected user endpoint via token header
  const handleLoadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const result = await fetchSecureUsersList();
      
      if (result.success) {
        setDbUsers(result.data);
      } else {
        alert(`❌ API Error:\n${result.message}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // ACTION: Hits the HttpOnly refresh cookie endpoint manually
  const handleSilentRefresh = async () => {
    const res = await serviceTriggerSilentRefresh();
    if (res.success) {
      alert(`🎉 Refresh Successful!\nNew token stored in memory:\n\n${res.token.substring(0, 40)}...`);
    } else {
      alert(`❌ Silent Refresh Denied:\n${res.message}`);
    }
  };

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
            
            // Card Image Box
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
              
              // Card Footer
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

    // ==================== DEVELOPMENT SECURITY DASHBOARD AREA ====================
    React.createElement(
      "div",
      { 
        style: { 
          padding: "25px", 
          background: "#1e293b", 
          color: "#f8fafc", 
          borderTop: "4px solid #3b82f6", 
          marginTop: "40px",
          fontFamily: "sans-serif"
        } 
      },
      React.createElement("h3", { style: { margin: "0 0 10px 0", color: "#38bdf8" } }, "🛡️ JWT Verification Sandbox"),
      React.createElement("p", { style: { fontSize: "14px", margin: "0 0 20px 0", color: "#94a3b8" } }, 
        "Use these tools to manually inspect bearer token authentication and verify the backend refresh logic sequence lifecycle live."
      ),
      
      // Control Row
      React.createElement(
        "div",
        { style: { display: "flex", gap: "15px", marginBottom: "20px" } },
        
        React.createElement(
          "button",
          { 
            onClick: handleLoadUsers,
            style: { padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }
          },
          isLoadingUsers ? "Querying SQL Database..." : "1. Test Protected GET /api/users"
        ),

        React.createElement(
          "button",
          { 
            onClick: handleSilentRefresh,
            style: { padding: "10px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }
          },
          "2. Execute POST /api/auth/refresh"
        )
      ),

      // Output Table Display Area
      dbUsers.length > 0 && React.createElement(
        "div",
        { style: { background: "#0f172a", padding: "15px", borderRadius: "6px", border: "1px solid #334155" } },
        React.createElement("h4", { style: { margin: "0 0 10px 0", color: "#a78bfa" } }, "Database Payload Authorized:"),
        React.createElement(
          "ul",
          { style: { margin: 0, paddingLeft: "20px" } },
          dbUsers.map((user, i) => (
            React.createElement("li", { key: i, style: { fontSize: "14px", color: "#cbd5e1", margin: "5px 0" } }, 
              `ID: ${user.userId} | Username: ${user.username} | Role: ${user.role} | Status: ${user.accountStatus}`
            )
          ))
        )
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