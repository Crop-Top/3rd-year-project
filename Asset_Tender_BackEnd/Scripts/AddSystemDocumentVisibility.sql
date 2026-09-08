-- Visibility flags for Documents.SystemDocuments (document repository).
-- Run against campus database GRP-03-15.
-- Note: the live table is Documents.SystemDocuments (not Tender.SystemDocuments).

SET NOCOUNT ON;

IF OBJECT_ID(N'Documents.SystemDocuments', N'U') IS NULL
BEGIN
    RAISERROR(N'Documents.SystemDocuments was not found. Check schema name.', 16, 1);
    RETURN;
END
GO

IF COL_LENGTH(N'Documents.SystemDocuments', N'VisibleToInternal') IS NULL
BEGIN
    ALTER TABLE Documents.SystemDocuments
        ADD VisibleToInternal BIT NOT NULL
            CONSTRAINT DF_SysDocs_Internal DEFAULT (1);
END
GO

IF COL_LENGTH(N'Documents.SystemDocuments', N'VisibleToExternal') IS NULL
BEGIN
    ALTER TABLE Documents.SystemDocuments
        ADD VisibleToExternal BIT NOT NULL
            CONSTRAINT DF_SysDocs_External DEFAULT (0);
END
GO
