using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Models.DTOs;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
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
    private readonly string _connectionString;

    public AuthController(IActiveDirectoryService activeDirectoryService, IConfiguration config)
    {
        _activeDirectoryService = activeDirectoryService;
        _config = config;

        // Reads directly from your .env file key
        _connectionString = _config["DB_CONNECTION"]
            ?? throw new InvalidOperationException("Database connection string not found in environment variables.");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        // 1. Verify credentials against Active Directory
        bool isAdAuthenticated = _activeDirectoryService.Authenticate(request.Username, request.Password);
        if (!isAdAuthenticated)
        {
            return Unauthorized(new { Message = "Invalid username or password." });
        }

        // 2. Fetch fresh profile fields straight from Active Directory attributes safely
        string fullName = request.Username;
        string email = $"{request.Username}@mandela.ac.za";
        string adObjectGuid = string.Empty;
        bool isStaffMember = false;

        try
        {
            var adAttributes = _activeDirectoryService.GetUserAttributes(request.Username, request.Password)
                as System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<string>>;

            if (adAttributes != null)
            {
                // Extract profile fields
                if (adAttributes.ContainsKey("displayname") && adAttributes["displayname"].Count > 0)
                    fullName = adAttributes["displayname"][0];

                if (adAttributes.ContainsKey("mail") && adAttributes["mail"].Count > 0)
                    email = adAttributes["mail"][0];

                // EXTRACT GUID HERE: Extracted cleanly without making a second service call
                if (adAttributes.ContainsKey("objectguid") && adAttributes["objectguid"].Count > 0)
                    adObjectGuid = adAttributes["objectguid"][0];

                // Verify if they belong to the mandatory Staff group
                if (adAttributes.ContainsKey("memberof"))
                {
                    string targetStaffGroup = "CN=NMMU All Staff,OU=Office 365 Groups,OU=Groups,OU=Admin,DC=nmmu,DC=ac,DC=za";

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

        // 2b. Gatekeeper check: If they are not in the Staff group, block them instantly.
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

            // 3. Just-In-Time Provisioning (UPSERT) via MERGE Statement matching your exact schema columns
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
                    (SELECT TOP 1 IdentityProviderID FROM [Lookup].[IdentityProviders] WHERE ProviderName = 'AD'), 
                    'Staff', 
                    0, -- IsRestricted default fallback (False)
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

            // 4. Generate Token Pairs
            var jwtId = Guid.NewGuid().ToString();
            var accessToken = GenerateJwtToken(applicationUser, jwtId);
            var refreshToken = GenerateRefreshTokenString();

            // 5. Save Refresh Token to tracking sessions
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

            // 6. Append HttpOnly Refresh Cookie
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.None,
                Expires = DateTimeOffset.UtcNow.AddDays(7),
                Path = "/"
            };
            Response.Cookies.Append("X-Refresh-Token", refreshToken, cookieOptions);

            // 7. Return payload to frontend
            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                Message = "Authentication Successful!",
                User = applicationUser
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

            // 1. Verify that the session is still active and grab user details
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

            // If validation fails, jump out early before running the update script
            if (applicationUser == null)
            {
                return Unauthorized(new { Message = "Session expired or turned invalid. Please log in again." });
            }

            // ==================== 🛠️ THE SLIDING WINDOW FIXED HERE ====================
            // 2. Extend the expiry timeline directly in the database row by 7 days
            var slidingWindowQuery = @"
            UPDATE [Security].[UserSessions]
            SET ExpiryDate = DATEADD(day, 7, SYSUTCDATETIME())
            WHERE RefreshToken = @RefreshToken;";

            using (var updateCmd = new SqlCommand(slidingWindowQuery, conn))
            {
                updateCmd.Parameters.AddWithValue("@RefreshToken", refreshToken);
                await updateCmd.ExecuteNonQueryAsync(); // Executes the slide update seamlessly
            }
            // =========================================================================
        }

        // Generate matching dynamic token layouts effortlessly
        var jwtId = Guid.NewGuid().ToString();
        string newAccessToken = GenerateJwtToken(applicationUser, jwtId);

        return Ok(new
        {
            AccessToken = newAccessToken,
            Message = "Token synchronized successfully."
        });
    }

    // ==================== TOKEN GENERATION HELPERS ====================

    private string GenerateJwtToken(UserDto user, string jwtId)
    {
        // Use the ":" separator to traverse into your "JwtSettings" block wrapper cleanly
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
            //expires: DateTime.UtcNow.AddSeconds(15),
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