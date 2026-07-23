using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
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
    public async Task<IActionResult> Login([FromBody] LoginRequest request, [FromServices] CaptchaService captchaService)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        string input = request.Username.Trim();
        bool isMandelaDomain = input.EndsWith("@mandela.ac.za", StringComparison.OrdinalIgnoreCase);
        bool hasEmailDomain = input.Contains("@");

        string adUsername = (isMandelaDomain || !hasEmailDomain)
            ? (input.Contains("@") ? input.Split('@')[0] : input)
            : input;
        string fullUpnEmail = $"{adUsername}@mandela.ac.za";

        // ------------------------------------------------------------------
        // PRE-CHECK: Inspect User Failure State & Enforce Lockouts / CAPTCHA
        // ------------------------------------------------------------------
        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var checkStatusQuery = @"
            SELECT FailedLoginAttempts, LockoutEnd, AccountStatus 
            FROM [Security].[Users] 
            WHERE Username = @Username OR Email = @Email;";

            int failedAttempts = 0;
            DateTimeOffset? lockoutEnd = null;
            string? accountStatus = null;

            using (var cmd = new SqlCommand(checkStatusQuery, conn))
            {
                cmd.Parameters.AddWithValue("@Username", adUsername);
                cmd.Parameters.AddWithValue("@Email", fullUpnEmail);

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    failedAttempts = reader["FailedLoginAttempts"] != DBNull.Value ? (int)reader["FailedLoginAttempts"] : 0;
                    lockoutEnd = reader["LockoutEnd"] != DBNull.Value ? (DateTimeOffset)reader["LockoutEnd"] : null;
                    accountStatus = reader["AccountStatus"]?.ToString();
                }
            }

            if (accountStatus == "Disabled" || accountStatus == "Inactive")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "Account is inactive. Please contact support." });
            }

            // 1. Check CAPTCHA requirement (Triggers at >= 3 failed attempts)
            bool captchaRequired = failedAttempts >= 3;
            if (captchaRequired)
            {
                bool isCaptchaValid = await captchaService.VerifyCaptchaAsync(request.CaptchaToken);
                if (!isCaptchaValid)
                {
                    return BadRequest(new
                    {
                        Message = "Security verification required. Please complete the CAPTCHA.",
                        RequiresCaptcha = true,
                        FailedAttempts = failedAttempts
                    });
                }
            }

            // 2. Check Lockout Timer
            if (lockoutEnd.HasValue && lockoutEnd.Value > DateTimeOffset.UtcNow)
            {
                var remainingSeconds = (int)Math.Ceiling((lockoutEnd.Value - DateTimeOffset.UtcNow).TotalSeconds);
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    Message = $"Too many failed attempts. Please wait {remainingSeconds} seconds before trying again.",
                    RetryAfterSeconds = remainingSeconds,
                    RequiresCaptcha = true
                });
            }
        }

        // ------------------------------------------------------------------
        // PATH A: Internal AD Users (No '@' provided OR '@mandela.ac.za')
        // ------------------------------------------------------------------
        if (!hasEmailDomain || isMandelaDomain)
        {
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
                return await RecordFailedAttemptAsync(adUsername, fullUpnEmail);
            }

            string fullName = adUsername;
            string email = fullUpnEmail;
            string adObjectGuid = string.Empty;
            bool isStaffMember = false;

            try
            {
                var adAttributes = _activeDirectoryService.GetUserAttributes(fullUpnEmail, request.Password)
                    as Dictionary<string, List<string>>;

                if (adAttributes == null)
                {
                    adAttributes = _activeDirectoryService.GetUserAttributes(adUsername, request.Password)
                        as Dictionary<string, List<string>>;
                }

                if (adAttributes != null)
                {
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
                ON (
                    (target.Email = source.Email AND source.Email IS NOT NULL)
                    OR (target.AD_ObjectGUID = source.AD_ObjectGUID AND source.AD_ObjectGUID IS NOT NULL)
                    OR target.Username = source.Username
                )
                WHEN MATCHED AND target.AccountStatus = 'Active' THEN
                    UPDATE SET 
                        target.Username = source.Username,
                        target.FullName = source.FullName,
                        target.Email = source.Email,
                        target.AD_ObjectGUID = ISNULL(source.AD_ObjectGUID, target.AD_ObjectGUID),
                        target.IdentityProviderID = source.IdentityProviderID,
                        target.FailedLoginAttempts = 0, -- Reset counter on successful login
                        target.LockoutEnd = NULL
                WHEN NOT MATCHED THEN
                    INSERT (Username, FullName, Email, IdentityProviderID, Role, IsRestricted, AccountStatus, AD_ObjectGUID, FailedLoginAttempts, LockoutEnd)
                    VALUES (
                        source.Username, 
                        source.FullName, 
                        source.Email, 
                        source.IdentityProviderID, 
                        'Staff', 
                        0,
                        'Active', 
                        source.AD_ObjectGUID,
                        0,
                        NULL
                    );

                SELECT UserID, Username, Role, Email 
                FROM [Security].[Users] 
                WHERE (Email = @Email OR Username = @Username) AND AccountStatus = 'Active';";

                using (var cmd = new SqlCommand(upsertUserQuery, conn))
                {
                    cmd.Parameters.AddWithValue("@Username", adUsername);
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

                return await CompleteLoginSessionAsync(userId, applicationUser);
            }
        }

        // ------------------------------------------------------------------
        // PATH B: External Local Users (Other domains, e.g. gmail.com)
        // ------------------------------------------------------------------
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

                // Reset failures on successful local login
                var resetQuery = "UPDATE [Security].[Users] SET FailedLoginAttempts = 0, LockoutEnd = NULL WHERE UserID = @UserID;";
                using (var resetCmd = new SqlCommand(resetQuery, conn))
                {
                    resetCmd.Parameters.AddWithValue("@UserID", localUser.UserId);
                    await resetCmd.ExecuteNonQueryAsync();
                }

                return await CompleteLoginSessionAsync(localUser.UserId, appUser);
            }
        }

        return await RecordFailedAttemptAsync(adUsername, fullUpnEmail);
    }

    // ------------------------------------------------------------------
    // HELPER: Increments Failure Counter & Applies Option B Timeout Scale
    // ------------------------------------------------------------------
    private async Task<IActionResult> RecordFailedAttemptAsync(string username, string email)
    {
        int updatedAttempts = 1;
        DateTimeOffset? newLockoutEnd = null;

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var getAttemptsQuery = @"
            SELECT FailedLoginAttempts 
            FROM [Security].[Users] 
            WHERE Username = @Username OR Email = @Email;";

            using (var cmd = new SqlCommand(getAttemptsQuery, conn))
            {
                cmd.Parameters.AddWithValue("@Username", username);
                cmd.Parameters.AddWithValue("@Email", email);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                {
                    updatedAttempts = ((int)result) + 1;
                }
            }

            // Option B Timeout Escalation Matrix
            switch (updatedAttempts)
            {
                case 3:
                    newLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(1);
                    break;
                case 4:
                    newLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(5);
                    break;
                case 5:
                    newLockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
                    break;
                case 6:
                    newLockoutEnd = DateTimeOffset.UtcNow.AddHours(1);
                    break;
                default:
                    if (updatedAttempts >= 7)
                    {
                        newLockoutEnd = DateTimeOffset.UtcNow.AddHours(2); // Capped at 2 hours
                    }
                    break;
            }

            var updateQuery = @"
            UPDATE [Security].[Users]
            SET FailedLoginAttempts = @FailedAttempts,
                LockoutEnd = @LockoutEnd
            WHERE Username = @Username OR Email = @Email;";

            using (var cmd = new SqlCommand(updateQuery, conn))
            {
                cmd.Parameters.AddWithValue("@FailedAttempts", updatedAttempts);
                cmd.Parameters.AddWithValue("@LockoutEnd", (object?)newLockoutEnd ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@Username", username);
                cmd.Parameters.AddWithValue("@Email", email);
                await cmd.ExecuteNonQueryAsync();
            }
        }

        int? retrySeconds = newLockoutEnd.HasValue ? (int)(newLockoutEnd.Value - DateTimeOffset.UtcNow).TotalSeconds : null;

        return StatusCode(StatusCodes.Status401Unauthorized, new
        {
            Message = newLockoutEnd.HasValue
                ? $"Invalid credentials. Temporary lock applied for {retrySeconds} seconds."
                : "Invalid username or password.",
            RequiresCaptcha = updatedAttempts >= 3,
            FailedAttempts = updatedAttempts,
            RetryAfterSeconds = retrySeconds
        });
    }

    private async Task<IActionResult> CompleteLoginSessionAsync(int userId, UserDto appUser)
    {
        var jwtId = Guid.NewGuid().ToString();
        string accessToken = GenerateJwtToken(appUser, jwtId);
        string refreshToken = GenerateRefreshTokenString();

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();
            var insertSessionQuery = @"
        INSERT INTO [Security].[UserSessions] (UserID, RefreshToken, ExpiryDate, IsRevoked)
        VALUES (@UserID, @RefreshToken, DATEADD(day, 7, SYSUTCDATETIME()), 0);";

            using var cmd = new SqlCommand(insertSessionQuery, conn);
            cmd.Parameters.AddWithValue("@UserID", userId);
            cmd.Parameters.AddWithValue("@RefreshToken", refreshToken);
            await cmd.ExecuteNonQueryAsync();
        }

        // ------------------------------------------------------------------
        // COOKIE CONFIGURATION FIX
        // ------------------------------------------------------------------
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            // Set SameSite to Lax (or None if React & API are on different ports/domains)
            SameSite = SameSiteMode.None,
            Secure = true, // Required when SameSite = None
            Expires = DateTimeOffset.UtcNow.AddDays(7),
            Path = "/"
        };

        Response.Cookies.Append("X-Refresh-Token", refreshToken, cookieOptions);

        return Ok(new
        {
            AccessToken = accessToken,
            User = appUser
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
    [AllowAnonymous] // <-- Change [Authorize] to [AllowAnonymous]
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
