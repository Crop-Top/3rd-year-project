using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin,SuperAdmin")]
public class AdminUsersController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;

    public AdminUsersController(Asset_Tender_DBContext dbContext)
    {
        _dbContext = dbContext;
    }

    public class UpdateUserRoleStatusDto
    {
        public string Role { get; set; } = string.Empty;
        public string AccountStatus { get; set; } = string.Empty;
    }

    [HttpPut("{id}/role-status")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> UpdateUserRoleAndStatus(int id, [FromBody] UpdateUserRoleStatusDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Role) || string.IsNullOrWhiteSpace(request.AccountStatus))
        {
            return BadRequest(new { Message = "Role and AccountStatus are required." });
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == id);

        if (user is null)
        {
            return NotFound(new { Message = "User not found." });
        }

        // Identify current caller's role from claims
        var callerRole = User.FindFirstValue(ClaimTypes.Role)
                         ?? User.FindFirstValue("role")
                         ?? string.Empty;

        bool isSuperAdmin = string.Equals(callerRole, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
        bool isRoleChanging = !string.Equals(user.Role, request.Role, StringComparison.OrdinalIgnoreCase);

        // Rule 1: Only SuperAdmins can change roles
        if (isRoleChanging && !isSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                Message = "Access Denied: Only Super Administrators have permission to modify user roles."
            });
        }

        // Rule 2: Bidder/External accounts cannot have their role changed
        bool isExistingBidder = string.Equals(user.Role, "Bidder", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(user.Role, "External", StringComparison.OrdinalIgnoreCase);

        if (isExistingBidder && isRoleChanging)
        {
            return BadRequest(new { Message = "Role changes are restricted for Bidder accounts." });
        }

        // Rule 3: Non-bidders cannot be converted into Bidder accounts
        if (!isExistingBidder && string.Equals(request.Role, "Bidder", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { Message = "Staff or Admin accounts cannot be converted to Bidder accounts." });
        }

        // Update fields
        if (isSuperAdmin)
        {
            user.Role = request.Role;
        }

        // Admins and SuperAdmins can both update status
        user.AccountStatus = request.AccountStatus;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            UserId = user.UserId,
            Email = user.Email,
            Role = user.Role,
            AccountStatus = user.AccountStatus,
            Message = "User role and status updated successfully."
        });
    }

    [HttpPut("{id}/approve")]
    public async Task<IActionResult> ApproveUser(int id)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.UserId == id);

        if (user is null)
        {
            return NotFound(new { Message = "User not found." });
        }

        if (user.AccountStatus == UserConstants.AccountStatusActive)
        {
            return BadRequest(new { Message = "User is already active." });
        }

        user.AccountStatus = UserConstants.AccountStatusActive;
        user.IsRestricted = false;

        await _dbContext.SaveChangesAsync();

        return Ok(new UserApprovalResponse
        {
            UserId = user.UserId,
            Email = user.Email,
            Role = user.Role,
            AccountStatus = user.AccountStatus,
            Message = "User approved successfully."
        });
    }

    [HttpPut("{id}/deny")]
    public async Task<IActionResult> DenyUser(int id)
    {
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.UserId == id);

        if (user is null)
        {
            return NotFound(new { Message = "User not found." });
        }

        user.AccountStatus = UserConstants.AccountStatusRejected;
        user.IsRestricted = true;

        await _dbContext.SaveChangesAsync();

        return Ok(new UserApprovalResponse
        {
            UserId = user.UserId,
            Email = user.Email,
            Role = user.Role,
            AccountStatus = user.AccountStatus,
            Message = "User registration denied successfully."
        });
    }

    [HttpGet("stats")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetUserStats()
    {
        try
        {
            var totalRecords = await _dbContext.Users.CountAsync();

            var activeRecords = await _dbContext.Users
                .CountAsync(u => u.AccountStatus.ToLower() == "active");

            var pendingCount = await _dbContext.Users
                .CountAsync(u => u.AccountStatus.ToLower() == "pending" || u.AccountStatus.ToLower() == "review");

            // REMOVED 'u.IsAdUser' - filtering purely by internal roles:
            var adUsersCount = await _dbContext.Users
                .CountAsync(u => u.Role.ToLower() == "staff"
                              || u.Role.ToLower() == "admin"
                              || u.Role.ToLower() == "superadmin");

            var bidderUsersCount = await _dbContext.Users
                .CountAsync(u => u.Role.ToLower() == "bidder"
                              || u.Role.ToLower() == "external");

            return Ok(new
            {
                totalRecords,
                activeRecords,
                pendingCount,
                adUsersCount,
                bidderUsersCount
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error loading stats", details = ex.Message });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int limit = 10, [FromQuery] string? search = null)
    {
        var query = _dbContext.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => u.Email.ToLower().Contains(searchLower)
                                  || u.Role.ToLower().Contains(searchLower)
                                  || u.AccountStatus.ToLower().Contains(searchLower));
        }

        var totalRecords = await query.CountAsync();

        // Calculate system-wide stats across all records
        var activeRecordsCount = await _dbContext.Users.CountAsync(u => u.AccountStatus.ToLower() == "active");
        var pendingCount = await _dbContext.Users.CountAsync(u => u.AccountStatus.ToLower() == "pending" || u.AccountStatus.ToLower() == "review");
        var adUsersCount = await _dbContext.Users.CountAsync(u => !u.Role.ToLower().Contains("bidder") && !u.Role.ToLower().Contains("external"));
        var bidderUsersCount = await _dbContext.Users.CountAsync(u => u.Role.ToLower().Contains("bidder") || u.Role.ToLower().Contains("external"));

        var users = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(u => new
            {
                UserId = u.UserId,
                Email = u.Email,
                Role = u.Role,
                AccountStatus = u.AccountStatus,
                IsRestricted = u.IsRestricted
            })
            .ToListAsync();

        return Ok(new
        {
            totalRecords,
            activeRecordsCount,
            pendingCount,
            adUsersCount,
            bidderUsersCount,
            items = users
        });
    }
}