-- Optional viewing date/time, end time, and location/venue for tender lots.
-- Run against campus database (e.g. GRP-03-15).

SET NOCOUNT ON;

IF OBJECT_ID(N'Tender.Listings', N'U') IS NULL
BEGIN
    RAISERROR(N'Tender.Listings was not found. Check schema name.', 16, 1);
    RETURN;
END
GO

IF COL_LENGTH(N'Tender.Listings', N'ViewingDate') IS NULL
BEGIN
    ALTER TABLE Tender.Listings
        ADD ViewingDate datetime2 NULL;
END
GO

IF COL_LENGTH(N'Tender.Listings', N'ViewingEndTime') IS NULL
BEGIN
    ALTER TABLE Tender.Listings
        ADD ViewingEndTime datetime2 NULL;
END
GO

IF COL_LENGTH(N'Tender.Listings', N'ViewingLocation') IS NULL
BEGIN
    ALTER TABLE Tender.Listings
        ADD ViewingLocation nvarchar(500) NULL;
END
GO
