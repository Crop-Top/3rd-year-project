-- Seed identity providers required for external registration and AD login.
-- Run against grp-03-15 before testing /api/Auth/register.

IF NOT EXISTS (
    SELECT 1 FROM Lookup.IdentityProviders
    WHERE ProviderName = 'Local'
)
BEGIN
    INSERT INTO Lookup.IdentityProviders (ProviderName, Description, IsActive)
    VALUES ('Local', 'External bidder local password authentication', 1);
END;

IF NOT EXISTS (
    SELECT 1 FROM Lookup.IdentityProviders
    WHERE ProviderName = 'ActiveDirectory'
)
BEGIN
    INSERT INTO Lookup.IdentityProviders (ProviderName, Description, IsActive)
    VALUES ('ActiveDirectory', 'NMU Active Directory SSO', 1);
END;
