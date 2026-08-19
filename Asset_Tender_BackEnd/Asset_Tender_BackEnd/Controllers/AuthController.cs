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
    private readonly IEmailService _emailService; // Added Email Service dependency
    private readonly string _connectionString;

    public AuthController(
        IActiveDirectoryService activeDirectoryService,
        IConfiguration config,
        Asset_Tender_DBContext dbContext,
        IPasswordHasherService passwordHasher,
        IEmailService emailService) // Injected Email Service
    {
        _activeDirectoryService = activeDirectoryService;
        _config = config;
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _emailService = emailService;

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
        // PRE-CHECK: Inspect Failure State, 24h Window Reset & Lockouts
        // ------------------------------------------------------------------
        int failedAttempts = 0;
        DateTimeOffset? lockoutEnd = null;
        DateTimeOffset? lastFailedAttempt = null;
        string? accountStatus = null;

        using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync();

            var checkStatusQuery = @"
            SELECT FailedLoginAttempts, LockoutEnd, LastFailedLoginAttempt, AccountStatus 
            FROM [Security].[Users] 
            WHERE Username = @Username OR Email = @Email;";

            using (var cmd = new SqlCommand(checkStatusQuery, conn))
            {
                cmd.Parameters.AddWithValue("@Username", adUsername);
                cmd.Parameters.AddWithValue("@Email", fullUpnEmail);

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    failedAttempts = reader["FailedLoginAttempts"] != DBNull.Value ? (int)reader["FailedLoginAttempts"] : 0;
                    lockoutEnd = reader["LockoutEnd"] != DBNull.Value ? (DateTimeOffset)reader["LockoutEnd"] : null;
                    lastFailedAttempt = reader["LastFailedLoginAttempt"] != DBNull.Value ? (DateTimeOffset)reader["LastFailedLoginAttempt"] : null;
                    accountStatus = reader["AccountStatus"]?.ToString();
                }
            }

            // 🕒 24-HOUR RESET CHECK: Has 24 hours passed since the LAST failed attempt?
            if (lastFailedAttempt.HasValue && lastFailedAttempt.Value.AddHours(24) <= DateTimeOffset.UtcNow)
            {
                failedAttempts = 0;
                lockoutEnd = null;

                var reset24hQuery = @"
                UPDATE [Security].[Users] 
                SET FailedLoginAttempts = 0, 
                    LockoutEnd = NULL, 
                    LastFailedLoginAttempt = NULL 
                WHERE Username = @Username OR Email = @Email;";

                using var resetCmd = new SqlCommand(reset24hQuery, conn);
                resetCmd.Parameters.AddWithValue("@Username", adUsername);
                resetCmd.Parameters.AddWithValue("@Email", fullUpnEmail);
                await resetCmd.ExecuteNonQueryAsync();
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
                    Message = $"Too many failed attempts. Account locked. Please wait {remainingSeconds} seconds before trying again.",
                    RetryAfterSeconds = remainingSeconds,
                    RequiresCaptcha = true,
                    FailedAttempts = failedAttempts
                });
            }
        }

        // ------------------------------------------------------------------
        // Account Status Pre-Check
        // ------------------------------------------------------------------
        if (!string.IsNullOrEmpty(accountStatus))
        {
            if (string.Equals(accountStatus, UserConstants.AccountStatusEmailUnverified, StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Status = "EmailUnverified",
                    Message = "Please verify your email address before signing in. Check your inbox for the verification link."
                });
            }

            if (string.Equals(accountStatus, UserConstants.AccountStatusPending, StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Status = "Pending",
                    Message = "Your registration request is currently pending admin approval. You will receive access once approved."
                });
            }

            if (string.Equals(accountStatus, "Rejected", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(accountStatus, "Denied", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Status = "Rejected",
                    Message = "Your account registration request was declined. Please contact support for more details."
                });
            }

            if (string.Equals(accountStatus, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Status = "Suspended",
                    Message = "Your account has been temporarily suspended. Please contact system support."
                });
            }

            if (string.Equals(accountStatus, "Disabled", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(accountStatus, "Inactive", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Status = accountStatus,
                    Message = "Account is inactive or disabled. Please contact support."
                });
            }
        }

        // ------------------------------------------------------------------
        // PATH A: Internal AD Users
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
                    target.FailedLoginAttempts = 0,
                    target.LockoutEnd = NULL,
                    target.LastFailedLoginAttempt = NULL
            WHEN NOT MATCHED THEN
                INSERT (Username, FullName, Email, IdentityProviderID, Role, IsRestricted, AccountStatus, AD_ObjectGUID, FailedLoginAttempts, LockoutEnd, LastFailedLoginAttempt)
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
                    NULL,
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
                                UserId = userId,
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
        // PATH B: External Local Users
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
                    UserId = localUser.UserId,
                    Username = localUser.Username,
                    Role = localUser.Role,
                    Email = localUser.Email
                };

                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                var resetQuery = @"
                UPDATE [Security].[Users] 
                SET FailedLoginAttempts = 0, 
                    LockoutEnd = NULL,
                    LastFailedLoginAttempt = NULL,
                    ResetToken = NULL,
                    ResetTokenExpiry = NULL
                WHERE UserID = @UserID;";
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

    private async Task<IActionResult> RecordFailedAttemptAsync(string adUsername, string fullUpnEmail)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        int currentAttempts = 0;
        var getAttemptsQuery = @"
        SELECT FailedLoginAttempts 
        FROM [Security].[Users] 
        WHERE Username = @Username OR Email = @Email;";

        using (var cmd = new SqlCommand(getAttemptsQuery, conn))
        {
            cmd.Parameters.AddWithValue("@Username", adUsername);
            cmd.Parameters.AddWithValue("@Email", fullUpnEmail);
            var result = await cmd.ExecuteScalarAsync();
            if (result != null && result != DBNull.Value)
            {
                currentAttempts = (int)result;
            }
        }

        int newAttempts = currentAttempts + 1;
        int lockoutMinutes = 0;

        // Escalation ladder mapping
        switch (newAttempts)
        {
            case 3:
                lockoutMinutes = 1;     // Attempt 3 -> 1 min
                break;
            case 6:
                lockoutMinutes = 5;     // Attempt 6 -> 5 mins
                break;
            case 7:
                lockoutMinutes = 15;    // Attempt 7 -> 15 mins
                break;
            case 8:
                lockoutMinutes = 30;    // Attempt 8 -> 30 mins
                break;
            case 9:
                lockoutMinutes = 60;    // Attempt 9 -> 1 hour
                break;
            default:
                if (newAttempts >= 10)
                {
                    lockoutMinutes = 120; // Attempt 10+ -> Capped at 2 hours
                }
                break;
        }

        DateTimeOffset? nextLockoutEnd = lockoutMinutes > 0
            ? DateTimeOffset.UtcNow.AddMinutes(lockoutMinutes)
            : null;

        // Updates count, sets lockout timer, and overwrites LastFailedLoginAttempt with UTC now to restart the 24h window
        var updateQuery = @"
        UPDATE [Security].[Users]
        SET FailedLoginAttempts = @FailedAttempts,
            LastFailedLoginAttempt = @Now,
            LockoutEnd = @LockoutEnd
        WHERE Username = @Username OR Email = @Email;";

        using (var updateCmd = new SqlCommand(updateQuery, conn))
        {
            updateCmd.Parameters.AddWithValue("@FailedAttempts", newAttempts);
            updateCmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
            updateCmd.Parameters.AddWithValue("@LockoutEnd", (object?)nextLockoutEnd ?? DBNull.Value);
            updateCmd.Parameters.AddWithValue("@Username", adUsername);
            updateCmd.Parameters.AddWithValue("@Email", fullUpnEmail);

            await updateCmd.ExecuteNonQueryAsync();
        }

        if (nextLockoutEnd.HasValue)
        {
            int retrySeconds = lockoutMinutes * 60;
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                Message = $"Too many failed login attempts. Account locked for {lockoutMinutes} minute(s).",
                RetryAfterSeconds = retrySeconds,
                RequiresCaptcha = true,
                FailedAttempts = newAttempts
            });
        }

        return Unauthorized(new
        {
            Message = "Invalid username or password.",
            RequiresCaptcha = newAttempts >= 3,
            FailedAttempts = newAttempts
        });
    }

    private async Task<IActionResult> CompleteLoginSessionAsync(int userId, UserDto appUser)
    {
        appUser.UserId = userId;
        string accessToken = GenerateJwtToken(appUser, Guid.NewGuid().ToString());
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

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.None,
            Secure = true,
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
            var verificationToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

            var user = new User
            {
                Username = request.Email.Trim(),
                Email = request.Email.Trim(),
                CompanyName = request.CompanyName.Trim(),
                FullName = request.CompanyName.Trim(),
                PasswordHash = _passwordHasher.HashPassword(request.Password),
                IdentityProviderId = localProviderId,
                Role = UserConstants.RoleBidder,
                AccountStatus = UserConstants.AccountStatusEmailUnverified,
                IsEmailVerified = false,
                EmailVerificationToken = verificationToken,
                EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24),
                IsRestricted = false
            };

            _dbContext.Users.Add(user);
            await _dbContext.SaveChangesAsync();

            // Wrap email sending in its own try-catch block
            try
            {
                var frontendUrl = (_config["AppSettings:FrontendBaseUrl"] ?? "https://localhost:3000").TrimEnd('/');
                var verifyUrl = $"{frontendUrl}/verify-email?token={verificationToken}&email={Uri.EscapeDataString(user.Email)}";

                await _emailService.SendEmailVerificationAsync(user.Email, verifyUrl);
            }
            catch (Exception emailEx)
            {
                // Log the email failure, but let the registration succeed
                System.Diagnostics.Debug.WriteLine($"Failed to send verification email: {emailEx.Message}");

                return StatusCode(StatusCodes.Status201Created, new RegisterResponse
                {
                    Message = "Registration created successfully, but we could not send the verification email. Please contact support or request a re-send.",
                    UserId = user.UserId
                });
            }

            return StatusCode(StatusCodes.Status201Created, new RegisterResponse
            {
                Message = "Registration successful! Please check your email to verify your address before admin review.",
                UserId = user.UserId
            });
        }
        catch (DbUpdateException)
        {
            return StatusCode(500, new
            {
                Message = "Registration failed due to a database error. Please try again later."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                Message = "Registration failed.",
                Error = ex.Message,
                StackTrace = ex.StackTrace
            });
        }
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
    {
        // FIXED: Used _dbContext instead of _context
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower());

        if (user == null)
            return BadRequest(new { Message = "Invalid request." });

        if (user.IsEmailVerified)
            return BadRequest(new { Message = "Email is already verified." });

        if (user.EmailVerificationToken != dto.Token ||
            user.EmailVerificationTokenExpiresAt < DateTime.UtcNow)
        {
            return BadRequest(new { Message = "Invalid or expired verification token." });
        }

        // FIXED: Set AccountStatus property to UserConstants.AccountStatusPending
        user.IsEmailVerified = true;
        user.AccountStatus = UserConstants.AccountStatusPending;
        user.EmailVerificationToken = null;
        user.EmailVerificationTokenExpiresAt = null;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Email verified successfully. Your registration is now awaiting administrative approval." });
    }

    [HttpPost("resend-verification")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendVerification([FromBody] ForgotPasswordRequest request)
    {
        var genericResponse = Ok(new
        {
            Message = "If an unverified account exists for that email, a new verification link has been sent."
        });

        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(request.Email))
        {
            return genericResponse;
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user is null ||
            user.IsEmailVerified ||
            !string.Equals(user.AccountStatus, UserConstants.AccountStatusEmailUnverified, StringComparison.OrdinalIgnoreCase))
        {
            return genericResponse;
        }

        var verificationToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        user.EmailVerificationToken = verificationToken;
        user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24);

        await _dbContext.SaveChangesAsync();

        try
        {
            var frontendUrl = (_config["AppSettings:FrontendBaseUrl"] ?? "https://localhost:3000").TrimEnd('/');
            var verifyUrl = $"{frontendUrl}/verify-email?token={verificationToken}&email={Uri.EscapeDataString(user.Email)}";
            await _emailService.SendEmailVerificationAsync(user.Email, verifyUrl);
        }
        catch (Exception emailEx)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to resend verification email: {emailEx.Message}");
        }

        return genericResponse;
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var genericResponse = Ok(new
        {
            Message = "Password reset email sent, check your inbox to reset your password. Link active for 15 minuts."
        });

        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(request.Email))
        {
            return genericResponse;
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user is null ||
            string.IsNullOrEmpty(user.PasswordHash) ||
            user.AccountStatus != UserConstants.AccountStatusActive)
        {
            return genericResponse;
        }

        var localProviderId = await _dbContext.Database
            .SqlQuery<int>($"""
            SELECT IdentityProviderID AS [Value]
            FROM Lookup.IdentityProviders
            WHERE ProviderName = {UserConstants.IdentityProviderLocal} AND IsActive = 1
            """)
            .SingleOrDefaultAsync();

        if (localProviderId == 0 || user.IdentityProviderId != localProviderId)
        {
            return genericResponse;
        }

        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        user.ResetToken = HashResetToken(rawToken);
        user.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(15);

        await _dbContext.SaveChangesAsync();

        try
        {
            var frontendUrl = _config["AppSettings:FrontendBaseUrl"] ?? "http://localhost:3000";
            var resetUrl = $"{frontendUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}";
            await _emailService.SendPasswordResetAsync(user.Email, resetUrl);
        }
        catch (Exception emailEx)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to send password reset email: {emailEx.Message}");
            // Still return generic success to avoid enumeration / leaking SMTP issues.
        }

        return genericResponse;
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { Message = "Token and a new password of at least 8 characters are required." });
        }

        var token = request.Token?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(token))
        {
            return BadRequest(new { Message = "Invalid or expired reset token." });
        }

        var tokenHash = HashResetToken(token);
        var now = DateTime.UtcNow;

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u =>
                u.ResetToken == tokenHash &&
                u.ResetTokenExpiry != null &&
                u.ResetTokenExpiry > now);

        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
        {
            return BadRequest(new { Message = "Invalid or expired reset token." });
        }

        if (user.AccountStatus != UserConstants.AccountStatusActive)
        {
            return BadRequest(new { Message = "Invalid or expired reset token." });
        }

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.ResetToken = null;
        user.ResetTokenExpiry = null;
        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;

        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Password has been reset successfully. You can now sign in." });
    }

    private static string HashResetToken(string rawToken)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(hashBytes);
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
    [AllowAnonymous]
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
            SELECT u.UserID, u.Username, u.Role, u.Email 
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
                            UserId = (int)reader["UserID"],
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
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
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