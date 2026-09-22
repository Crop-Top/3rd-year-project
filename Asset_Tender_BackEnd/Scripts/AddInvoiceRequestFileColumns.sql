-- Persist issued invoice PDFs on InvoiceRequests for later retrieval and resend.
-- Run against campus database (e.g. GRP-03-15).

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.InvoiceRequests', N'U') IS NULL
BEGIN
    RAISERROR(N'dbo.InvoiceRequests was not found. Check schema/table name.', 16, 1);
    RETURN;
END
GO

IF COL_LENGTH(N'dbo.InvoiceRequests', N'InvoiceFileName') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceRequests
        ADD InvoiceFileName nvarchar(260) NULL;
END
GO

IF COL_LENGTH(N'dbo.InvoiceRequests', N'InvoiceContentType') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceRequests
        ADD InvoiceContentType nvarchar(100) NULL;
END
GO

IF COL_LENGTH(N'dbo.InvoiceRequests', N'InvoiceData') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceRequests
        ADD InvoiceData varbinary(max) NULL;
END
GO

IF COL_LENGTH(N'dbo.InvoiceRequests', N'InvoicedAt') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceRequests
        ADD InvoicedAt datetime2 NULL;
END
GO
