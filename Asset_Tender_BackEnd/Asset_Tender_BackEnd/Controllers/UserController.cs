using Asset_Tender_BackEnd.Models.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // 🔒 Requires valid authentication for all endpoints in this controller
    public class UserController : ControllerBase
    {
        private readonly Asset_Tender_DBContext dbContext;

        public UserController(Asset_Tender_DBContext dbContext)
        {
            this.dbContext = dbContext;
        }

        [HttpGet]
        [Authorize(Roles = "SuperAdmin,Admin")] // 🔒 Restrict user management list to Admins
        public async Task<IActionResult> GetAllUsers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 10,
            [FromQuery] string? search = null)
        {
            var query = dbContext.Users.AsQueryable();

            // Search filter matching React frontend parameters
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(u =>
                    u.Username.ToLower().Contains(term) ||
                    u.Email.ToLower().Contains(term) ||
                    u.Role.ToLower().Contains(term) ||
                    u.AccountStatus.ToLower().Contains(term));
            }

            // Total count for frontend totalPages calculation
            var totalRecords = await query.CountAsync();

            // Paginated slice
            var users = await query
                .OrderBy(u => u.Username)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(u => new
                {
                    UserId = u.UserId,
                    FullName = u.Username, // Mapped so React frontend picks it up cleanly
                    Email = u.Email,
                    Role = u.Role,
                    Status = u.AccountStatus
                })
                .ToListAsync();

            return Ok(new
            {
                totalRecords,
                page,
                limit,
                items = users
            });
        }

        //[HttpDelete("{id}")]
        //[Authorize(Roles = "SuperAdmin")] // 🔒 Strict deletion permission
        //public async Task<IActionResult> DeleteUser(string id)
        //{
        //    var user = await dbContext.Users.FindAsync(id);
        //    if (user == null)
        //    {
        //        return NotFound(new { message = "User not found." });
        //    }

        //    dbContext.Users.Remove(user);
        //    await dbContext.SaveChangesAsync();

        //    return NoContent();
        //}
    }
}