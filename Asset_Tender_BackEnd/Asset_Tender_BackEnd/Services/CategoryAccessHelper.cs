using Asset_Tender_BackEnd.Constants;

namespace Asset_Tender_BackEnd.Services;

public static class CategoryAccessHelper
{
    /// <summary>
    /// Seeded category name for vehicle lots (Assets.Categories).
    /// External Bidder (role Bidder) may only access this category.
    /// </summary>
    public const string VehiclesCategoryName = "Vehicles";

    public static bool IsVehiclesCategory(string? categoryName) =>
        !string.IsNullOrWhiteSpace(categoryName) &&
        categoryName.Trim().Equals(VehiclesCategoryName, StringComparison.OrdinalIgnoreCase);

    public static bool IsBidderRole(string? role) =>
        !string.IsNullOrWhiteSpace(role) &&
        role.Trim().Equals(UserConstants.RoleBidder, StringComparison.OrdinalIgnoreCase);

    public static bool CanRevealCompetitiveBids(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        var r = role.Trim();
        return r.Equals(UserConstants.RoleAdmin, StringComparison.OrdinalIgnoreCase) ||
               r.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase);
    }
}
