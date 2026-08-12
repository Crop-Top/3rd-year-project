-- Run once against the campus Asset Tender SQL Server database.
-- Schema: Tender (same as Invoices)

IF OBJECT_ID(N'Tender.ProofOfPayment', N'U') IS NULL
BEGIN
    CREATE TABLE Tender.ProofOfPayment (
        ProofOfPaymentId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        InvoiceId INT NOT NULL,
        ContentType NVARCHAR(100) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        Data VARBINARY(MAX) NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_PoP_UploadedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_PoP_InvoiceId UNIQUE (InvoiceId),
        CONSTRAINT FK_PoP_Invoice FOREIGN KEY (InvoiceId)
            REFERENCES Tender.Invoices (InvoiceID)
    );
END
GO
