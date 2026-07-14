using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IActiveDirectoryService _activeDirectoryService;
    private readonly IConfiguration _config;
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IPasswordHasherService _passwordHasher;
    private readonly string _connectionString;

    public AuthController(
        IActiveDirectoryService activeDirectoryService,
        IConfiguration config,
        Asset_Tender_DBContext dbContext,
        IPasswordHasherService passwordHasher)
    {
        _activeDirectoryService = activeDirectoryService;
        _config = config;
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;

        _connectionString = _config["DB_CONNECTION"]
            ?? _config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Database connection string not found in environment variables.");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        bool isAdAuthenticated = _activeDirectoryService.Authenticate(request.Username, request.Password);
        if (!isAdAuthenticated)
        {
            return Unauthorized(new { Message = "Invalid username or password." });
        }

        string fullName = request.Username;
        string email = $"{request.Username}@mandela.ac.za";
        string adObjectGuid = string.Empty;
        bool isStaffMember = false;

        try
        {
            var adAttributes = _activeDirectoryService.GetUserAttributes(request.Username, request.Password)
                as Dictionary<string, List<string>>;

            if (adAttributes != null)
            {
                if (adAttributes.ContainsKey("displayname") && adAttributes["displayname"].Count > 0)
                    fullName = adAttributes["displayname"][0];

                if (adAttributes.ContainsKey("mail") && adAttributes["mail"].Count > 0)
                    email = adAttributes["mail"][0];

                if (adAttributes.ContainsKey("objectguid") && adAttributes["objectguid"].Count > 0)
                    adObjectGuid = adAttributes["objectguid"][0];

                if (adAttributes.ContainsKey("memberof"))
                {
                    const string targetStaffGroup = "CN=NMMU All Staff,OU=Office 365 Groups,OU=Groups,OU=Admin,DC=nmmu,DC=ac,DC=za";

                    foreach (var group in adAttributes["memberof"])
                    {
                        if (string.Equals(group, targetStaffGroup, StringComparison.OrdinalIgnoreCase))
                        {
                            isStaffMember = true;
                            break;
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"AD parsing fallback triggered: {ex.Message}");
        }

        if (!isStaffMember)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                Message = "Access Denied. Only registered staff members are permitted to access this portal."
            });
        }

        UserDto? applicationUser = null;
        int userId = 0;

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var upsertUserQuery = @"
            MERGE [Security].[Users] AS target
            USING (SELECT @Username AS Username) AS source
            ON (target.Username = source.Username)
            WHEN MATCHED AND target.AccountStatus = 'Active' THEN
                UPDATE SET 
                    target.FullName = @FullName,
                    target.Email = @Email,
                    target.AD_ObjectGUID = @AD_ObjectGUID
            WHEN NOT MATCHED THEN
                INSERT (Username, FullName, Email, IdentityProviderID, Role, IsRestricted, AccountStatus, AD_ObjectGUID)
                VALUES (
                    source.Username, 
                    @FullName, 
                    @Email, 
                    (SELECT TOP 1 IdentityProviderID FROM [Lookup].[IdentityProviders] WHERE ProviderName = 'ActiveDirectory'), 
                    'Staff', 
                    0,
                    'Active', 
                    @AD_ObjectGUID
                );
            
            SELECT UserID, Username, Role, Email 
            FROM [Security].[Users] 
            WHERE Username = @Username AND AccountStatus = 'Active';";

            using (var cmd = new SqlCommand(upsertUserQuery, conn))
            {
                cmd.Parameters.AddWithValue("@Username", request.Username);
                cmd.Parameters.AddWithValue("@FullName", fullName);
                cmd.Parameters.AddWithValue("@Email", email);

                object sqlGuidParameter = DBNull.Value;
                if (!string.IsNullOrEmpty(adObjectGuid) && Guid.TryParse(adObjectGuid, out Guid parsedGuid))
                {
                    sqlGuidParameter = parsedGuid;
                }

                cmd.Parameters.AddWithValue("@AD_ObjectGUID", sqlGuidParameter);

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        userId = (int)reader["UserID"];
                        applicationUser = new UserDto
                        {
                            Username = reader["Username"].ToString()!,
                            Role = reader["Role"].ToString()!,
                            Email = reader["Email"].ToString()!
                        };
                    }
                }
            }

            if (applicationUser == null)
            {
                return Unauthorized(new { Message = "Account is disabled or could not be provisioned." });
            }

            var jwtId = Guid.NewGuid().ToString();
            var accessToken = GenerateJwtToken(applicationUser, jwtId);
            var refreshToken = GenerateRefreshTokenString();

            var insertSessionQuery = @"
            INSERT INTO [Security].[UserSessions] (UserID, RefreshToken, JwtIdentifier, CreatedDate, ExpiryDate, IsRevoked)
            VALUES (@UserID, @RefreshToken, @JwtIdentifier, SYSUTCDATETIME(), DATEADD(day, 7, SYSUTCDATETIME()), 0)";

            using (var cmd = new SqlCommand(insertSessionQuery, conn))
            {
                cmd.Parameters.AddWithValue("@UserID", userId);
                cmd.Parameters.AddWithValue("@RefreshToken", refreshToken);
                cmd.Parameters.AddWithValue("@JwtIdentifier", jwtId);
                await cmd.ExecuteNonQueryAsync();
            }

            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = DateTimeOffset.UtcNow.AddDays(7),
                Path = "/"
            };
            Response.Cookies.Append("X-Refresh-Token", refreshToken, cookieOptions);

            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                Message = "Authentication Successful!",
                User = applicationUser
            });
        }
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

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (!Request.Cookies.TryGetValue("X-Refresh-Token", out string? refreshToken) || string.IsNullOrEmpty(refreshToken))
        {
            return Ok(new { Message = "Logged out successfully." });
        }

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var revokeSessionQuery = @"
                UPDATE [Security].[UserSessions]
                SET IsRevoked = 1
                WHERE RefreshToken = @RefreshToken AND IsRevoked = 0;";

            using (var cmd = new SqlCommand(revokeSessionQuery, conn))
            {
                cmd.Parameters.AddWithValue("@RefreshToken", refreshToken);
                await cmd.ExecuteNonQueryAsync();
            }
        }

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddDays(-1),
            Path = "/"
        };
        Response.Cookies.Append("X-Refresh-Token", "", cookieOptions);

        return Ok(new { Message = "Session terminated and logged out successfully." });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        if (!Request.Cookies.TryGetValue("X-Refresh-Token", out string? refreshToken) || string.IsNullOrEmpty(refreshToken))
        {
            return Unauthorized(new { Message = "Missing refresh token session cookie." });
        }

        UserDto? applicationUser = null;

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var verifyQuery = @"
            SELECT u.Username, u.Role, u.Email 
            FROM [Security].[UserSessions] s
            INNER JOIN [Security].[Users] u ON s.UserID = u.UserID
            WHERE s.RefreshToken = @RefreshToken 
              AND s.IsRevoked = 0 
              AND s.ExpiryDate > SYSUTCDATETIME();";

            using (var cmd = new SqlCommand(verifyQuery, conn))
            {
                cmd.Parameters.AddWithValue("@RefreshToken", refreshToken);

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        applicationUser = new UserDto
                        {
                            Username = reader["Username"].ToString()!,
                            Role = reader["Role"].ToString()!,
                            Email = reader["Email"].ToString()!
                        };
                    }
                }
            }

            if (applicationUser == null)
            {
                return Unauthorized(new { Message = "Session expired or turned invalid. Please log in again." });
            }

            var slidingWindowQuery = @"
            UPDATE [Security].[UserSessions]
            SET ExpiryDate = DATEADD(day, 7, SYSUTCDATETIME())
            WHERE RefreshToken = @RefreshToken;";

            using (var updateCmd = new SqlCommand(slidingWindowQuery, conn))
            {
                updateCmd.Parameters.AddWithValue("@RefreshToken", refreshToken);
                await updateCmd.ExecuteNonQueryAsync();
            }
        }

        var jwtId = Guid.NewGuid().ToString();
        string newAccessToken = GenerateJwtToken(applicationUser, jwtId);

        return Ok(new
        {
            AccessToken = newAccessToken,
            Message = "Token synchronized successfully."
        });
    }

    private string GenerateJwtToken(UserDto user, string jwtId)
    {
        var jwtKey = _config["JwtSettings:Secret"]
            ?? throw new InvalidOperationException("JWT_KEY environment variable is not configured.");

        var jwtIssuer = _config["JwtSettings:Issuer"] ?? "AssetTenderBackend";
        var jwtAudience = _config["JwtSettings:Audience"] ?? "AssetTenderFrontEnd";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, jwtId)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateRefreshTokenString()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
}
