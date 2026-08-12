import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/staff_style/WinningBidsPage.css";
import { getWinningBids } from "../../services/winningBidsService.js";
import { resolveImageUrl } from "../../services/assetService.js";

const formatRand = (amount) =>
  `R ${Number(amount).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function WinningBidsPage() {
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  const goToAsset = (id) => {
    if (id) navigate(`/asset/${id}`);
  };

  return (
    <div className="wb-page">
      <PortalHeader />

      <main className="wb-main">
        <div className="wb-header">
          <h1>My Winning Bids</h1>
          <p>View lots you have successfully won on closed tenders.</p>
        </div>

        {loading && <p>Loading your winning bids...</p>}
        {loadError && (
          <p style={{ color: "#b91c1c", fontWeight: "bold" }}>{loadError}</p>
        )}
        {!loading && !loadError && bids.length === 0 && (
          <p>You currently have no winning bids.</p>
        )}

        {!loading && !loadError && bids.length > 0 && (
          <div className="wb-list">
            {bids.map((bid) => {
              const lotId = bid.listingId || bid.id;
              return (
                <div
                  className="wb-card wb-card-clickable"
                  key={bid.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToAsset(lotId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToAsset(lotId);
                    }
                  }}
                >
                  <div className="wb-image">
                    <img
                      src={
                        resolveImageUrl(bid.image) ||
                        "https://via.placeholder.com/300x200?text=No+Image"
                      }
                      alt={bid.title}
                    />
                  </div>

                  <div className="wb-info">
                    <div className="wb-top-row">
                      <div>
                        <h3>
                          Lot {bid.listingId || bid.id}: {bid.title}
                        </h3>
                        <p>
                          <strong>SN:</strong> {bid.serial}
                        </p>
                        <p>Won: {bid.wonDate}</p>
                      </div>

                      <div className="wb-price-section">
                        <span className="wb-status verified">Won</span>
                        <small>Total Amount</small>
                        <h2>{formatRand(bid.amount)}</h2>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

export default WinningBidsPage;
