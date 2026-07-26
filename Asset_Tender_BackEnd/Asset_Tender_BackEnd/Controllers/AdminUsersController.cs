using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
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

        // Rule 1: Bidder/External accounts cannot have their role changed
        bool isExistingBidder = string.Equals(user.Role, "Bidder", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(user.Role, "External", StringComparison.OrdinalIgnoreCase);

        if (isExistingBidder && !string.Equals(user.Role, request.Role, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { Message = "Role changes are restricted for Bidder accounts." });
        }

        // Rule 2: Non-bidders cannot be converted into Bidder accounts
        if (!isExistingBidder && string.Equals(request.Role, "Bidder", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { Message = "Staff or Admin accounts cannot be converted to Bidder accounts." });
        }

        // Update allowed fields only
        user.Role = request.Role;
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
}