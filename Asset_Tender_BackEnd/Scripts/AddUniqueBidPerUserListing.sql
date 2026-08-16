-- One sealed offer per user per listing (sealed tender box).
-- Run against the campus database (grp-03-15) before/with deploy.

SET NOCOUNT ON;

------------------------------------------------------------
-- Remove duplicate bids: keep the latest BidId per (ListingId, BidderId)
------------------------------------------------------------
;WITH ranked AS (
    SELECT
        BidId,
        ROW_NUMBER() OVER (
            PARTITION BY ListingId, BidderId
            ORDER BY BidTimestamp DESC, BidId DESC
        ) AS rn
    FROM Tender.Bids
)
DELETE FROM Tender.Bids
WHERE BidId IN (SELECT BidId FROM ranked WHERE rn > 1);

------------------------------------------------------------
-- Unique index
------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UQ_Bids_Listing_Bidder'
      AND object_id = OBJECT_ID(N'Tender.Bids')
)
BEGIN
    CREATE UNIQUE INDEX UQ_Bids_Listing_Bidder
        ON Tender.Bids (ListingId, BidderId);
END
GO
