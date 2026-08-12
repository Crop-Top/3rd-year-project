-- Ensure Lookup.PaymentStatus has the rows used by PoP workflow.
-- Adjust StatusName values if your campus seed uses different labels.

IF OBJECT_ID(N'Lookup.PaymentStatus', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Lookup.PaymentStatus WHERE StatusName IN (N'Pending POP', N'Pending PoP'))
        INSERT INTO Lookup.PaymentStatus (StatusName, Description, DisplayOrder)
        VALUES (N'Pending POP', N'Awaiting proof of payment upload', 1);

    IF NOT EXISTS (SELECT 1 FROM Lookup.PaymentStatus WHERE StatusName = N'Processing')
        INSERT INTO Lookup.PaymentStatus (StatusName, Description, DisplayOrder)
        VALUES (N'Processing', N'Proof uploaded; awaiting admin verification', 2);

    IF NOT EXISTS (SELECT 1 FROM Lookup.PaymentStatus WHERE StatusName = N'Verified')
        INSERT INTO Lookup.PaymentStatus (StatusName, Description, DisplayOrder)
        VALUES (N'Verified', N'Proof verified by admin', 3);

    IF NOT EXISTS (SELECT 1 FROM Lookup.PaymentStatus WHERE StatusName = N'Rejected')
        INSERT INTO Lookup.PaymentStatus (StatusName, Description, DisplayOrder)
        VALUES (N'Rejected', N'Proof rejected; bidder may re-upload', 4);
END
GO
