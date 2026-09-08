-- Optional bootstrap for audit logging (Phase 2). Safe to run multiple times.
IF OBJECT_ID(N'Lookup.AuditAction', N'U') IS NULL
BEGIN
    CREATE TABLE Lookup.AuditAction (
        AuditActionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ActionName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(255) NOT NULL
    );
END;

IF OBJECT_ID(N'Security.AuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE Security.AuditLogs (
        AuditLogID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserID INT NOT NULL,
        AuditActionID INT NOT NULL,
        TableName NVARCHAR(128) NOT NULL,
        RecordID INT NOT NULL,
        ChangeDetails NVARCHAR(MAX) NULL,
        Timestamp DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserID) REFERENCES Security.Users(UserID),
        CONSTRAINT FK_AuditLogs_AuditAction FOREIGN KEY (AuditActionID) REFERENCES Lookup.AuditAction(AuditActionID)
    );
END;
