import { useState } from "react";
import { useNavigate } from "react-router-dom"; // 1. Added Router hook
import "../../styles/admin_style/AdminPage.css";

// You can pass user as a prop, or retrieve it from localStorage/AuthContext
function AdminPage({ user }) {
  const navigate = useNavigate();

  // Fallback: If user is not passed as a prop, check localStorage
  const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");

  const [searchQuery, setSearchQuery] = useState("");
  const [tenders] = useState([
    {
      id: 1,
      title: "2019 Toyota Corolla 1.6 Quest",
      category: "VEHICLES-SEDANS",
      description: "Ex-fleet vehicle in good condition. Full service history available. Mileage: 149,000km.",
      price: 85000,
      image: "",
      status: "active",
    },
    {
      id: 2,
      title: "Olympus CX23 Upright Microscope",
      category: "SCIENTIFIC",
      description: "Microscope in excellent condition. Latest optics. Fully functional, minor cosmetic wear.",
      price: 4500,
      image: "",
      status: "active",
    },
    {
      id: 3,
      title: "Dell PowerEdge R740 Server Batch",
      category: "IT INFRASTRUCTURE",
      description: "Lot of 3 decommissioned servers. No HDDs included. RAM and CPU intact. Sold as single lot.",
      price: 22000,
      image: "",
      status: "active",
    },
    {
      id: 4,
      title: "2018 Isuzu D-Max 250 Single Cab",
      category: "VEHICLES-UTILITY",
      description: "Reliable work vehicle. Canopy included. Spare parts available. Shows typical work-related wear.",
      price: 115000,
      image: "",
      status: "active",
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleLoadMore = () => {
    setIsLoading(true);
    // Simulate loading delay
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  // 2. Navigation Handler with Role Guard
  const handlePendingApprovalsClick = () => {
    if (currentUser?.role === "Admin") {
      navigate("/pending-approvals");
    } else {
      alert("Access Denied: Only users with the Admin role can access Pending Approvals.");
    }
  };

  const filteredTenders = tenders.filter((tender) =>
    tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tender.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-top">
          <h1 className="admin-title">Asset Tender Portal</h1>
          <div className="admin-search">
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={handleSearch}
              className="admin-search-input"
            />
            <svg className="admin-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>

        {/* Action buttons */}
        <div className="admin-actions">
          <button className="admin-btn admin-btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            User Management
          </button>

          {/* 3. Updated Pending Approvals Button */}
          <button 
            className="admin-btn admin-btn-secondary"
            onClick={handlePendingApprovalsClick}
          >
            Pending Approvals
          </button>

          <button className="admin-btn admin-btn-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Post New Tender
          </button>
        </div>
      </header>

      {/* Current Asset section */}
      <section className="admin-section">
        <h2 className="admin-section-title">Current Asset</h2>

        {filteredTenders.length > 0 ? (
          <div className="tender-grid">
            {filteredTenders.map((tender) => (
              <div key={tender.id} className="tender-card">
                <div className="tender-image-wrapper">
                  <img src={tender.image} alt={tender.title} className="tender-image" />
                  <span className="tender-badge">{tender.category}</span>
                </div>

                <div className="tender-content">
                  <h3 className="tender-title">{tender.title}</h3>
                  <p className="tender-description">{tender.description}</p>

                  <div className="tender-footer">
                    <div>
                      <p className="tender-label">Loading Bid</p>
                      <p className="tender-price">R {tender.price.toLocaleString()}</p>
                    </div>
                    <button className="tender-btn">Manage Tender</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tender-empty">
            <p>No tenders found matching "{searchQuery}"</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && <div className="tender-loading">Loading more tenders...</div>}

        {/* Load more button */}
        {!isLoading && filteredTenders.length > 0 && (
          <div className="tender-load-more">
            <button onClick={handleLoadMore} className="load-more-btn">
              Load More
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminPage;