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

        string input = request.Username.Trim();
        bool isMandelaDomain = input.EndsWith("@mandela.ac.za", StringComparison.OrdinalIgnoreCase);
        bool hasEmailDomain = input.Contains("@");

        // ------------------------------------------------------------------
        // PATH A: Internal AD Users (No '@' provided OR '@mandela.ac.za')
        // ------------------------------------------------------------------
        if (!hasEmailDomain || isMandelaDomain)
        {
            // Define both formats up front
            string adUsername = isMandelaDomain ? input.Split('@')[0] : input;
            string fullUpnEmail = $"{adUsername}@mandela.ac.za";

            // SINGLE AD Call — try clean username, fallback to full email if LDAP requires UPN
            bool isAdAuthenticated = false;
            try
            {
                isAdAuthenticated = _activeDirectoryService.Authenticate(adUsername, request.Password);
                if (!isAdAuthenticated)
                {
                    isAdAuthenticated = _activeDirectoryService.Authenticate(fullUpnEmail, request.Password);
                }
            }
            catch
            {
                isAdAuthenticated = false;
            }

            if (!isAdAuthenticated)
            {
                return Unauthorized(new { Message = "Invalid username or password." });
            }

            string fullName = adUsername;
            string email = fullUpnEmail;
            string adObjectGuid = string.Empty;
            bool isStaffMember = false;

            try
            {
                // Pass fullUpnEmail so LDAP search query always finds the account UPN
                var adAttributes = _activeDirectoryService.GetUserAttributes(fullUpnEmail, request.Password)
                    as Dictionary<string, List<string>>;

                // Fallback to clean username if UPN query returned null
                if (adAttributes == null)
                {
                    adAttributes = _activeDirectoryService.GetUserAttributes(adUsername, request.Password)
                        as Dictionary<string, List<string>>;
                }

                if (adAttributes != null)
                {
                    // Helper to find keys regardless of LDAP casing (e.g. memberOf vs memberof)
                    string? GetKey(string keyName) =>
                        adAttributes.Keys.FirstOrDefault(k => k.Equals(keyName, StringComparison.OrdinalIgnoreCase));

                    var displayKey = GetKey("displayname");
                    if (displayKey != null && adAttributes[displayKey].Count > 0)
                        fullName = adAttributes[displayKey][0];

                    var mailKey = GetKey("mail");
                    if (mailKey != null && adAttributes[mailKey].Count > 0)
                        email = adAttributes[mailKey][0];

                    var guidKey = GetKey("objectguid");
                    if (guidKey != null && adAttributes[guidKey].Count > 0)
                        adObjectGuid = adAttributes[guidKey][0];

                    var groupKey = GetKey("memberof");
                    if (groupKey != null)
                    {
                        const string targetStaffGroup = "CN=All Staff,OU=Groups,OU=Admin,DC=Mandela,DC=ac,DC=za";

                        foreach (var group in adAttributes[groupKey])
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

            // Fast Database Upsert
            UserDto? applicationUser = null;
            int userId = 0;

            using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync();

                var upsertUserQuery = @"
                    MERGE [Security].[Users] AS target
                    USING (
                        SELECT 
                            @Username AS Username,
                            @Email AS Email,
                            @FullName AS FullName,
                            @AD_ObjectGUID AS AD_ObjectGUID,
                            ISNULL((SELECT TOP 1 IdentityProviderID FROM [Lookup].[IdentityProviders] WHERE ProviderName = 'AD'), 1) AS IdentityProviderID
                    ) AS source
                    -- Match on Email OR AD_ObjectGUID to prevent duplicate accounts
                    ON (
                        (target.Email = source.Email AND source.Email IS NOT NULL)
                        OR (target.AD_ObjectGUID = source.AD_ObjectGUID AND source.AD_ObjectGUID IS NOT NULL)
                        OR target.Username = source.Username
                    )
                    WHEN MATCHED AND target.AccountStatus = 'Active' THEN
                        UPDATE SET 
                            target.Username = source.Username, -- Standardizes existing usernames
                            target.FullName = source.FullName,
                            target.Email = source.Email,
                            target.AD_ObjectGUID = ISNULL(source.AD_ObjectGUID, target.AD_ObjectGUID),
                            target.IdentityProviderID = source.IdentityProviderID
                    WHEN NOT MATCHED THEN
                        INSERT (Username, FullName, Email, IdentityProviderID, Role, IsRestricted, AccountStatus, AD_ObjectGUID)
                        VALUES (
                            source.Username, 
                            source.FullName, 
                            source.Email, 
                            source.IdentityProviderID, 
                            'Staff', -- Default role for new users
                            0,
                            'Active', 
                            source.AD_ObjectGUID
                        );

                    SELECT UserID, Username, Role, Email 
                    FROM [Security].[Users] 
                    WHERE (Email = @Email OR Username = @Username) AND AccountStatus = 'Active';";

                using (var cmd = new SqlCommand(upsertUserQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@Username", adUsername); // Standardized to short username
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
                                Role = reader["Role"].ToString()!, // Preserves 'Admin' or existing custom roles
                                Email = reader["Email"].ToString()!
                            };
                        }
                    }
                }

                if (applicationUser == null)
                {
                    return Unauthorized(new { Message = "Account is disabled or could not be provisioned." });
                }

                return await CompleteLoginSessionAsync(conn, userId, applicationUser);
            }
        }

        // ------------------------------------------------------------------
        // PATH B: External Local Users (Other domains, e.g. gmail.com)
        // ------------------------------------------------------------------
        // ZERO Active Directory calls hit for external users
        var localUser = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == input.ToLower() && u.AccountStatus == "Active");

        if (localUser != null && !string.IsNullOrEmpty(localUser.PasswordHash))
        {
            bool isPasswordValid = _passwordHasher.VerifyPassword(localUser.PasswordHash, request.Password);
            if (isPasswordValid)
            {
                var appUser = new UserDto
                {
                    Username = localUser.Username,
                    Role = localUser.Role,
                    Email = localUser.Email
                };

                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();
                return await CompleteLoginSessionAsync(conn, localUser.UserId, appUser);
            }
        }

        return Unauthorized(new { Message = "Invalid username or password." });
    }

    // Helper method to create session and return response
    private async Task<IActionResult> CompleteLoginSessionAsync(SqlConnection conn, int userId, UserDto applicationUser)
    {
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
