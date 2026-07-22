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
}
