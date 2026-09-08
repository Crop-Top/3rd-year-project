using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Services;

public class ReportService : IReportService
{
    private static readonly DateTime SqlMinDate = new(1753, 1, 1);
    private static readonly DateTime SqlMaxDate = new(9999, 12, 31, 23, 59, 59);

    private static readonly HashSet<string> KnownReportTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "disposal-outcomes",
        "tender-register",
        "offer-register",
        "expired-unsold",
        "user-summary",
        "financial-recovery",
        "user-activity"
    };

    private readonly Asset_Tender_DBContext _dbContext;

    public ReportService(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ReportResponse> GenerateAsync(
        string reportType,
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken = default)
    {
        if (!KnownReportTypes.Contains(reportType))
        {
            throw new ArgumentException($"Unknown report type: {reportType}");
        }

        return reportType.ToLowerInvariant() switch
        {
            "disposal-outcomes" => await BuildDisposalOutcomesAsync(startDate, endDate, generatedBy, cancellationToken),
            "tender-register" => await BuildTenderRegisterAsync(startDate, endDate, generatedBy, cancellationToken),
            "offer-register" => await BuildOfferRegisterAsync(startDate, endDate, generatedBy, cancellationToken),
            "expired-unsold" => await BuildExpiredUnsoldAsync(startDate, endDate, generatedBy, cancellationToken),
            "user-summary" => await BuildUserSummaryAsync(startDate, endDate, generatedBy, cancellationToken),
            "financial-recovery" => await BuildFinancialRecoveryAsync(startDate, endDate, generatedBy, cancellationToken),
            "user-activity" => await BuildUserActivityAsync(startDate, endDate, generatedBy, cancellationToken),
            _ => throw new ArgumentException($"Unknown report type: {reportType}")
        };
    }

    private static (DateTime Start, DateTime End) NormalizeRange(DateTime? startDate, DateTime? endDate)
    {
        var start = startDate?.Date ?? SqlMinDate;
        var end = endDate?.Date.AddDays(1).AddTicks(-1) ?? SqlMaxDate;
        return (start, end);
    }

    private static bool IsClosedTenderStatus(string? statusName) =>
        string.Equals(statusName, UserConstants.TenderStatusClosed, StringComparison.OrdinalIgnoreCase)
        || string.Equals(statusName, UserConstants.TenderStatusCancelled, StringComparison.OrdinalIgnoreCase)
        || string.Equals(statusName, UserConstants.TenderStatusRejected, StringComparison.OrdinalIgnoreCase);

    private static bool IsOpenTenderStatus(string? statusName) =>
        string.Equals(statusName, UserConstants.TenderStatusOpen, StringComparison.OrdinalIgnoreCase)
        || string.Equals(statusName, "Open", StringComparison.OrdinalIgnoreCase);

    private static string ResolveOutcome(string? assetStatus, string? tenderStatus, bool hasBids)
    {
        if (string.Equals(assetStatus, UserConstants.AssetStatusDonation, StringComparison.OrdinalIgnoreCase))
        {
            return "Donated";
        }

        if (string.Equals(assetStatus, UserConstants.AssetStatusScrap, StringComparison.OrdinalIgnoreCase))
        {
            return "Scrap";
        }

        if (string.Equals(assetStatus, UserConstants.AssetStatusRejected, StringComparison.OrdinalIgnoreCase)
            || string.Equals(tenderStatus, UserConstants.TenderStatusRejected, StringComparison.OrdinalIgnoreCase))
        {
            return "Rejected";
        }

        if (IsClosedTenderStatus(tenderStatus))
        {
            return hasBids ? "Sold" : "Unsold";
        }

        if (string.Equals(tenderStatus, UserConstants.TenderStatusCancelled, StringComparison.OrdinalIgnoreCase))
        {
            return "Cancelled";
        }

        return assetStatus ?? tenderStatus ?? "Unknown";
    }

    private static string FormatMoney(decimal value) => value.ToString("N2");

    private static string FormatDate(DateTime? value) =>
        value.HasValue ? value.Value.ToString("yyyy-MM-dd") : "N/A";

    private async Task<ReportResponse> BuildDisposalOutcomesAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);

        var raw = await (
            from listing in _dbContext.TenderListings.AsNoTracking()
            join asset in _dbContext.Assets.AsNoTracking() on listing.AssetId equals asset.AssetId
            join category in _dbContext.Categories.AsNoTracking() on asset.CategoryId equals category.CategoryId into catGroup
            from category in catGroup.DefaultIfEmpty()
            join condition in _dbContext.AssetConditions.AsNoTracking() on asset.AssetConditionId equals condition.AssetConditionId into condGroup
            from condition in condGroup.DefaultIfEmpty()
            join assetStatus in _dbContext.AssetStatuses.AsNoTracking() on asset.AssetStatusId equals assetStatus.AssetStatusId into astGroup
            from assetStatus in astGroup.DefaultIfEmpty()
            join tenderStatus in _dbContext.TenderStatuses.AsNoTracking() on listing.TenderStatusId equals tenderStatus.TenderStatusId into tndGroup
            from tenderStatus in tndGroup.DefaultIfEmpty()
            join uploader in _dbContext.Users.AsNoTracking() on asset.UploadedBy equals uploader.UserId into upGroup
            from uploader in upGroup.DefaultIfEmpty()
            join approver in _dbContext.Users.AsNoTracking() on asset.ApprovedBy equals approver.UserId into appGroup
            from approver in appGroup.DefaultIfEmpty()
            let bidCount = _dbContext.Bids.Count(b => b.ListingId == listing.ListingId)
            let leadingBid = _dbContext.Bids
                .Where(b => b.ListingId == listing.ListingId)
                .Select(b => (decimal?)b.BidAmount)
                .Max() ?? listing.StartingBid
            let effectiveDate = listing.ClosedDate ?? listing.EndTime
            where effectiveDate >= range.Start && effectiveDate <= range.End
            where tenderStatus != null && (
                    tenderStatus.StatusName == UserConstants.TenderStatusClosed
                    || tenderStatus.StatusName == UserConstants.TenderStatusCancelled
                    || tenderStatus.StatusName == UserConstants.TenderStatusRejected)
                || assetStatus != null && (
                    assetStatus.StatusName == UserConstants.AssetStatusDonation
                    || assetStatus.StatusName == UserConstants.AssetStatusScrap
                    || assetStatus.StatusName == UserConstants.AssetStatusRejected)
            select new
            {
                listing.ListingId,
                asset.AssetName,
                Department = asset.DepartmentName != null && asset.DepartmentName != ""
                    ? asset.DepartmentName
                    : "N/A",
                Category = category != null ? category.CategoryName : "N/A",
                Condition = condition != null ? condition.ConditionName : "N/A",
                TenderStatus = tenderStatus != null ? tenderStatus.StatusName : "N/A",
                AssetStatus = assetStatus != null ? assetStatus.StatusName : "N/A",
                listing.StartingBid,
                LeadingBid = leadingBid,
                asset.ReccomendedPrice,
                listing.PublishedDate,
                EffectiveDate = effectiveDate,
                UploadedBy = uploader != null ? (uploader.FullName ?? uploader.Username) : "N/A",
                ApprovedBy = approver != null ? (approver.FullName ?? approver.Username) : "N/A",
                BidCount = bidCount
            }).ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "assetName", Label = "Asset Name" },
            new() { Key = "department", Label = "Department" },
            new() { Key = "category", Label = "Category" },
            new() { Key = "condition", Label = "Condition" },
            new() { Key = "tenderStatus", Label = "Tender Status" },
            new() { Key = "outcome", Label = "Outcome" },
            new() { Key = "startingBid", Label = "Starting Bid (R)" },
            new() { Key = "leadingBid", Label = "Leading/Winning Bid (R)" },
            new() { Key = "recommendedPrice", Label = "Recommended Price (R)" },
            new() { Key = "publishedDate", Label = "Published Date" },
            new() { Key = "closedDate", Label = "Closed/End Date" },
            new() { Key = "uploadedBy", Label = "Uploaded By" },
            new() { Key = "approvedBy", Label = "Approved By" }
        };

        var rows = raw.Select(item =>
        {
            var outcome = ResolveOutcome(item.AssetStatus, item.TenderStatus, item.BidCount > 0);
            return new Dictionary<string, string>
            {
                ["assetName"] = item.AssetName ?? "N/A",
                ["department"] = item.Department,
                ["category"] = item.Category,
                ["condition"] = item.Condition,
                ["tenderStatus"] = item.TenderStatus,
                ["outcome"] = outcome,
                ["startingBid"] = FormatMoney(item.StartingBid),
                ["leadingBid"] = FormatMoney(item.LeadingBid),
                ["recommendedPrice"] = FormatMoney(item.ReccomendedPrice),
                ["publishedDate"] = FormatDate(item.PublishedDate),
                ["closedDate"] = FormatDate(item.EffectiveDate),
                ["uploadedBy"] = item.UploadedBy,
                ["approvedBy"] = item.ApprovedBy
            };
        }).ToList();

        var soldCount = rows.Count(r => r["outcome"] == "Sold");
        var unsoldCount = rows.Count(r => r["outcome"] == "Unsold");
        var donatedScrapCount = rows.Count(r => r["outcome"] is "Donated" or "Scrap");
        var totalRecovery = raw.Where(r => r.BidCount > 0 && IsClosedTenderStatus(r.TenderStatus))
            .Sum(r => r.LeadingBid);

        return new ReportResponse
        {
            ReportType = "disposal-outcomes",
            Title = "Asset Disposal Outcomes",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalAssets"] = rows.Count.ToString(),
                ["sold"] = soldCount.ToString(),
                ["unsold"] = unsoldCount.ToString(),
                ["donatedOrScrap"] = donatedScrapCount.ToString(),
                ["totalRecovery"] = FormatMoney(totalRecovery)
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildTenderRegisterAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);
        var items = await TenderQueryHelper.ProjectListings(_dbContext)
            .Where(t =>
                (t.PublishedDate ?? t.StartTime) >= range.Start
                && (t.PublishedDate ?? t.StartTime) <= range.End)
            .OrderByDescending(t => t.PublishedDate ?? t.StartTime)
            .ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "listingId", Label = "Listing ID" },
            new() { Key = "assetName", Label = "Asset" },
            new() { Key = "department", Label = "Department" },
            new() { Key = "status", Label = "Status" },
            new() { Key = "isActive", Label = "Active" },
            new() { Key = "startTime", Label = "Start Time" },
            new() { Key = "endTime", Label = "End Time" },
            new() { Key = "bidCount", Label = "Bid Count" },
            new() { Key = "leadingBid", Label = "Leading Bid (R)" },
            new() { Key = "startingBid", Label = "Starting Bid (R)" }
        };

        var rows = items.Select(t => new Dictionary<string, string>
        {
            ["listingId"] = t.ListingId.ToString(),
            ["assetName"] = t.AssetName,
            ["department"] = t.DepartmentName ?? "N/A",
            ["status"] = t.TenderStatusName,
            ["isActive"] = t.IsActive ? "Yes" : "No",
            ["startTime"] = t.StartTime.ToString("yyyy-MM-dd HH:mm"),
            ["endTime"] = t.EndTime.ToString("yyyy-MM-dd HH:mm"),
            ["bidCount"] = t.BidCount.ToString(),
            ["leadingBid"] = FormatMoney(t.LeadingBid),
            ["startingBid"] = FormatMoney(t.StartingBid)
        }).ToList();

        return new ReportResponse
        {
            ReportType = "tender-register",
            Title = "Tender Register",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalTenders"] = rows.Count.ToString(),
                ["activeTenders"] = items.Count(t => t.IsActive && IsOpenTenderStatus(t.TenderStatusName)).ToString(),
                ["withBids"] = items.Count(t => t.BidCount > 0).ToString()
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildOfferRegisterAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);

        var raw = await (
            from bid in _dbContext.Bids.AsNoTracking()
            join listing in _dbContext.TenderListings.AsNoTracking() on bid.ListingId equals listing.ListingId
            join asset in _dbContext.Assets.AsNoTracking() on listing.AssetId equals asset.AssetId
            join bidder in _dbContext.Users.AsNoTracking() on bid.BidderId equals bidder.UserId
            let maxBid = _dbContext.Bids
                .Where(b => b.ListingId == bid.ListingId)
                .Max(b => (decimal?)b.BidAmount)
            where bid.BidTimestamp >= range.Start && bid.BidTimestamp <= range.End
            orderby bid.BidTimestamp descending
            select new
            {
                bid.ListingId,
                AssetName = asset.AssetName ?? "N/A",
                BidderName = bidder.FullName ?? bidder.Username,
                bidder.Role,
                bid.BidAmount,
                bid.BidTimestamp,
                IsLeading = maxBid == bid.BidAmount
            }).ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "listingId", Label = "Listing ID" },
            new() { Key = "assetName", Label = "Asset" },
            new() { Key = "bidderName", Label = "Bidder" },
            new() { Key = "role", Label = "Role" },
            new() { Key = "amount", Label = "Offer Amount (R)" },
            new() { Key = "timestamp", Label = "Timestamp" },
            new() { Key = "leadingAtClose", Label = "Leading at Close" }
        };

        var rows = raw.Select(o => new Dictionary<string, string>
        {
            ["listingId"] = o.ListingId.ToString(),
            ["assetName"] = o.AssetName,
            ["bidderName"] = o.BidderName,
            ["role"] = o.Role,
            ["amount"] = FormatMoney(o.BidAmount),
            ["timestamp"] = o.BidTimestamp.ToString("yyyy-MM-dd HH:mm"),
            ["leadingAtClose"] = o.IsLeading ? "Yes" : "No"
        }).ToList();

        return new ReportResponse
        {
            ReportType = "offer-register",
            Title = "Offer Register",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalOffers"] = rows.Count.ToString(),
                ["uniqueListings"] = raw.Select(r => r.ListingId).Distinct().Count().ToString(),
                ["totalOfferValue"] = FormatMoney(raw.Sum(r => r.BidAmount))
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildExpiredUnsoldAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);
        var now = DateTime.Now;

        var items = await TenderQueryHelper.ExpiredForAdmin(_dbContext)
            .Where(t => t.EndTime >= range.Start && t.EndTime <= range.End && t.EndTime <= now)
            .Where(t => t.BidCount == 0)
            .OrderBy(t => t.EndTime)
            .ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "listingId", Label = "Listing ID" },
            new() { Key = "assetName", Label = "Asset" },
            new() { Key = "category", Label = "Category" },
            new() { Key = "endDate", Label = "End Date" },
            new() { Key = "daysSinceExpiry", Label = "Days Since Expiry" },
            new() { Key = "bidCount", Label = "Bid Count" },
            new() { Key = "leadingBid", Label = "Leading Bid (R)" },
            new() { Key = "assetStatus", Label = "Asset Status" }
        };

        var rows = items.Select(t =>
        {
            var daysSince = (int)Math.Max(0, (now - t.EndTime).TotalDays);
            return new Dictionary<string, string>
            {
                ["listingId"] = t.ListingId.ToString(),
                ["assetName"] = t.AssetName,
                ["category"] = t.CategoryName,
                ["endDate"] = t.EndTime.ToString("yyyy-MM-dd"),
                ["daysSinceExpiry"] = daysSince.ToString(),
                ["bidCount"] = t.BidCount.ToString(),
                ["leadingBid"] = FormatMoney(t.LeadingBid),
                ["assetStatus"] = t.AssetStatusName
            };
        }).ToList();

        return new ReportResponse
        {
            ReportType = "expired-unsold",
            Title = "Expired & Unsold Assets",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalExpiredUnsold"] = rows.Count.ToString(),
                ["avgDaysSinceExpiry"] = rows.Count == 0
                    ? "0"
                    : Math.Round(rows.Average(r => double.Parse(r["daysSinceExpiry"])), 1).ToString()
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildUserSummaryAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        Dictionary<int, string> providerMap;
        try
        {
            providerMap = await _dbContext.IdentityProviders
                .AsNoTracking()
                .Select(p => new { p.IdentityProviderID, p.ProviderName })
                .ToDictionaryAsync(p => p.IdentityProviderID, p => p.ProviderName, cancellationToken);
        }
        catch
        {
            providerMap = new Dictionary<int, string>();
        }

        var users = await _dbContext.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .Select(user => new
            {
                user.Email,
                user.Role,
                user.AccountStatus,
                user.CompanyName,
                user.IdentityProviderId,
                user.IsEmailVerified,
                user.IsRestricted
            })
            .ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "email", Label = "Email" },
            new() { Key = "role", Label = "Role" },
            new() { Key = "accountStatus", Label = "Account Status" },
            new() { Key = "companyName", Label = "Company" },
            new() { Key = "identityProvider", Label = "Identity Provider" },
            new() { Key = "emailVerified", Label = "Email Verified" },
            new() { Key = "restricted", Label = "Restricted" }
        };

        var rows = users.Select(u => new Dictionary<string, string>
        {
            ["email"] = u.Email,
            ["role"] = u.Role,
            ["accountStatus"] = u.AccountStatus,
            ["companyName"] = u.CompanyName ?? "N/A",
            ["identityProvider"] = providerMap.TryGetValue(u.IdentityProviderId, out var providerName)
                ? providerName
                : "Unknown",
            ["emailVerified"] = u.IsEmailVerified ? "Yes" : "No",
            ["restricted"] = u.IsRestricted ? "Yes" : "No"
        }).ToList();

        var pendingCount = users.Count(u =>
            string.Equals(u.AccountStatus, UserConstants.AccountStatusPending, StringComparison.OrdinalIgnoreCase)
            || string.Equals(u.AccountStatus, "Review", StringComparison.OrdinalIgnoreCase));

        return new ReportResponse
        {
            ReportType = "user-summary",
            Title = "User & Registration Summary",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalUsers"] = users.Count.ToString(),
                ["activeUsers"] = users.Count(u => string.Equals(u.AccountStatus, UserConstants.AccountStatusActive, StringComparison.OrdinalIgnoreCase)).ToString(),
                ["pendingUsers"] = pendingCount.ToString(),
                ["staffUsers"] = users.Count(u => string.Equals(u.Role, UserConstants.RoleStaff, StringComparison.OrdinalIgnoreCase)).ToString(),
                ["bidderUsers"] = users.Count(u => string.Equals(u.Role, UserConstants.RoleBidder, StringComparison.OrdinalIgnoreCase)).ToString()
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildFinancialRecoveryAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);

        var raw = await (
            from listing in _dbContext.TenderListings.AsNoTracking()
            join asset in _dbContext.Assets.AsNoTracking() on listing.AssetId equals asset.AssetId
            join tenderStatus in _dbContext.TenderStatuses.AsNoTracking() on listing.TenderStatusId equals tenderStatus.TenderStatusId
            let bidCount = _dbContext.Bids.Count(b => b.ListingId == listing.ListingId)
            let leadingBid = _dbContext.Bids
                .Where(b => b.ListingId == listing.ListingId)
                .Select(b => (decimal?)b.BidAmount)
                .Max() ?? listing.StartingBid
            let effectiveDate = listing.ClosedDate ?? listing.EndTime
            where effectiveDate >= range.Start && effectiveDate <= range.End
            where tenderStatus.StatusName == UserConstants.TenderStatusClosed
                || tenderStatus.StatusName == "Closed"
            select new
            {
                listing.ListingId,
                AssetName = asset.AssetName ?? "N/A",
                asset.ReccomendedPrice,
                LeadingBid = leadingBid,
                listing.StartingBid,
                BidCount = bidCount
            }).ToListAsync(cancellationToken);

        var columns = new List<ReportColumn>
        {
            new() { Key = "listingId", Label = "Listing ID" },
            new() { Key = "assetName", Label = "Asset" },
            new() { Key = "recommendedPrice", Label = "Recommended Price (R)" },
            new() { Key = "startingBid", Label = "Starting Bid (R)" },
            new() { Key = "leadingBid", Label = "Leading Bid (R)" },
            new() { Key = "recoveryRate", Label = "Recovery %" },
            new() { Key = "bidCount", Label = "Bid Count" }
        };

        var rows = raw.Select(item =>
        {
            var recoveryRate = item.ReccomendedPrice > 0
                ? Math.Round(item.LeadingBid / item.ReccomendedPrice * 100m, 1)
                : 0m;

            return new Dictionary<string, string>
            {
                ["listingId"] = item.ListingId.ToString(),
                ["assetName"] = item.AssetName,
                ["recommendedPrice"] = FormatMoney(item.ReccomendedPrice),
                ["startingBid"] = FormatMoney(item.StartingBid),
                ["leadingBid"] = FormatMoney(item.LeadingBid),
                ["recoveryRate"] = $"{recoveryRate}%",
                ["bidCount"] = item.BidCount.ToString()
            };
        }).ToList();

        var totalRecommended = raw.Sum(r => r.ReccomendedPrice);
        var totalRecovery = raw.Sum(r => r.LeadingBid);

        return new ReportResponse
        {
            ReportType = "financial-recovery",
            Title = "Financial Recovery Summary",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["closedTenders"] = rows.Count.ToString(),
                ["totalRecommended"] = FormatMoney(totalRecommended),
                ["totalRecovery"] = FormatMoney(totalRecovery),
                ["overallRecoveryRate"] = totalRecommended > 0
                    ? $"{Math.Round(totalRecovery / totalRecommended * 100m, 1)}%"
                    : "0%"
            },
            Columns = columns,
            Rows = rows
        };
    }

    private async Task<ReportResponse> BuildUserActivityAsync(
        DateTime? startDate,
        DateTime? endDate,
        string generatedBy,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(startDate, endDate);

        List<UserActivityRow> entries;

        try
        {
            entries = await (
                from log in _dbContext.AuditLogs.AsNoTracking()
                join user in _dbContext.Users.AsNoTracking() on log.UserID equals user.UserId
                join action in _dbContext.AuditActions.AsNoTracking() on log.AuditActionID equals action.AuditActionID
                where log.Timestamp >= range.Start && log.Timestamp <= range.End
                orderby log.Timestamp descending
                select new UserActivityRow
                {
                    User = user.FullName ?? user.Username,
                    Action = action.ActionName,
                    Table = log.TableName,
                    RecordId = log.RecordID,
                    Details = log.ChangeDetails,
                    Timestamp = log.Timestamp
                })
                .ToListAsync(cancellationToken);
        }
        catch
        {
            entries = new List<UserActivityRow>();
        }

        var columns = new List<ReportColumn>
        {
            new() { Key = "timestamp", Label = "Timestamp" },
            new() { Key = "user", Label = "User" },
            new() { Key = "action", Label = "Action" },
            new() { Key = "tableName", Label = "Table" },
            new() { Key = "recordId", Label = "Record ID" },
            new() { Key = "details", Label = "Details" }
        };

        var rows = entries.Select(e => new Dictionary<string, string>
        {
            ["timestamp"] = e.Timestamp.ToString("yyyy-MM-dd HH:mm"),
            ["user"] = e.User,
            ["action"] = e.Action,
            ["tableName"] = e.Table,
            ["recordId"] = e.RecordId.ToString(),
            ["details"] = e.Details ?? string.Empty
        }).ToList();

        return new ReportResponse
        {
            ReportType = "user-activity",
            Title = "User Activity / Change Log",
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
            StartDate = startDate,
            EndDate = endDate,
            Summary = new Dictionary<string, string>
            {
                ["totalEvents"] = rows.Count.ToString(),
                ["uniqueUsers"] = entries.Select(e => e.User).Distinct().Count().ToString()
            },
            Columns = columns,
            Rows = rows
        };
    }

    private sealed class UserActivityRow
    {
        public string User { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public int RecordId { get; set; }
        public string? Details { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
