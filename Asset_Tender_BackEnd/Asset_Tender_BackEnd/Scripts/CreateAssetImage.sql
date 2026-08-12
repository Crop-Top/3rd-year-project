-- Run once against the campus Asset Tender SQL Server database.
-- Schema: Assets (same as Inventory)

IF OBJECT_ID(N'Assets.AssetImage', N'U') IS NULL
BEGIN
    CREATE TABLE Assets.AssetImage (
        AssetImageId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetId INT NOT NULL,
        ContentType NVARCHAR(100) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        Data VARBINARY(MAX) NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetImage_UploadedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_AssetImage_AssetId UNIQUE (AssetId),
        CONSTRAINT FK_AssetImage_Inventory FOREIGN KEY (AssetId)
            REFERENCES Assets.Inventory (AssetID)
    );
END
GO
