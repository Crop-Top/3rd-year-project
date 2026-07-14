using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IActiveDirectoryService _activeDirectoryService;
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IPasswordHasherService _passwordHasher;

    public AuthController(
        IActiveDirectoryService activeDirectoryService,
        Asset_Tender_DBContext dbContext,
        IPasswordHasherService passwordHasher)
    {
        _activeDirectoryService = activeDirectoryService;
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    [HttpPost("login")]
    public IActionResult Login(LoginRequest request)
    {
        bool authenticated = _activeDirectoryService.Authenticate(
            request.Username,
            request.Password);

        if (!authenticated)
        {
            return Unauthorized(new
            {
                Message = "Invalid username or password."
            });
        }

        return Ok(new
        {
            Message = "Authentication Successful!"
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new
            {
                Message = "Validation failed.",
                Errors = ModelState
                    .Where(e => e.Value?.Errors.Count > 0)
                    .ToDictionary(
                        e => e.Key,
                        e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray())
            });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _dbContext.Users
            .AnyAsync(u => u.Email.ToLower() == normalizedEmail);

        if (emailExists)
        {
            return Conflict(new
            {
                Message = "An account with this email already exists."
            });
        }

        var localProviderId = await _dbContext.Database
            .SqlQuery<int>($"""
                SELECT IdentityProviderID AS [Value]
                FROM Lookup.IdentityProviders
                WHERE ProviderName = {UserConstants.IdentityProviderLocal} AND IsActive = 1
                """)
            .SingleOrDefaultAsync();

        if (localProviderId == 0)
        {
            return StatusCode(500, new
            {
                Message = "Registration is unavailable. Local identity provider is not configured."
            });
        }

        try
        {
            var user = new User
            {
                Username = request.Email.Trim(),
                Email = request.Email.Trim(),
                CompanyName = request.CompanyName.Trim(),
                FullName = request.CompanyName.Trim(),
                PasswordHash = _passwordHasher.HashPassword(request.Password),
                IdentityProviderId = localProviderId,
                Role = UserConstants.RoleBidder,
                AccountStatus = UserConstants.AccountStatusPending,
                IsRestricted = false
            };

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, new RegisterResponse
            {
                Message = "Registration submitted. Your account is awaiting administrator approval.",
                UserId = user.UserId
            });
        }
        catch (DbUpdateException)
        {
            return StatusCode(500, new
            {
                Message = "Registration failed. Please try again later."
            });
        }
        catch (Exception)
        {
            return StatusCode(500, new
            {
                Message = "Registration failed. Please try again later."
            });
        }
    }

    [HttpPost("inspect")] //Temp
    public IActionResult Inspect(LoginRequest request)
    {
        if (!_activeDirectoryService.Authenticate(
            request.Username,
            request.Password))
        {
            return Unauthorized();
        }

        var attributes = _activeDirectoryService.GetUserAttributes(
            request.Username,
            request.Password);

        return Ok(attributes);
    }
}
