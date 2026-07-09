using Asset_Tender_BackEnd.Models.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly Asset_Tender_DBContext dbContext;
        public UserController(Asset_Tender_DBContext dbContext)
        {
            this.dbContext = dbContext;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await dbContext.Users
                .Select(u => new {
                    u.UserId,
                    u.Username,
                    u.Email,
                    u.Role,
                    u.AccountStatus
                }).ToListAsync();

            return Ok(users);
        }
    }
}
