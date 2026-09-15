-- Optional durable fix: make Tender.WinningBids.BidID a non-identity PK keyed by Tender.Bids.BidID.
-- Only run if you prefer not relying on IDENTITY_INSERT in the app.
-- Backup first. Review constraints/indexes on your campus DB before applying.

/*
-- Example approach (adjust if your table differs):
BEGIN TRAN;

CREATE TABLE Tender.WinningBids_New (
    BidID INT NOT NULL PRIMARY KEY, -- NOT identity; must equal Tender.Bids.BidID
    UserID INT NOT NULL,
    LotTitle NVARCHAR(200) NOT NULL,
    SerialNumber NVARCHAR(100) NULL,
    Amount DECIMAL(18,2) NOT NULL,
    WonDate DATETIMEOFFSET NOT NULL,
    Status NVARCHAR(50) NULL,
    ImageUrl NVARCHAR(500) NULL
);

INSERT INTO Tender.WinningBids_New (BidID, UserID, LotTitle, SerialNumber, Amount, WonDate, Status, ImageUrl)
SELECT BidID, UserID, LotTitle, SerialNumber, Amount, WonDate, Status, ImageUrl
FROM Tender.WinningBids;

-- Drop FKs referencing Tender.WinningBids if any, then:
EXEC sp_rename N'Tender.WinningBids', N'WinningBids_Old';
EXEC sp_rename N'Tender.WinningBids_New', N'WinningBids';

COMMIT;
*/
