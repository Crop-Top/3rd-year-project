using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Asset_Tender_BackEnd.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize(Roles = "Staff, Bidder, Admin, SuperAdmin")]
public class DocumentsController : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png",
        "image/jpeg",
        "image/jpg"
    };

    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IWebHostEnvironment _environment;

    public DocumentsController(Asset_Tender_DBContext dbContext, IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _environment = environment;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DocumentListItemResponse>>> ListDocuments()
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved." });
        }

        var isExternal = IsExternalRole(user.Role);
        var query = _dbContext.SystemDocuments.AsNoTracking();

        query = isExternal
            ? query.Where(d => d.VisibleToExternal)
            : query.Where(d => d.VisibleToInternal);

        var items = await (
            from d in query
            join u in _dbContext.Users.AsNoTracking() on d.UploadedBy equals u.UserId into up
            from u in up.DefaultIfEmpty()
            orderby d.UploadDate descending
            select new DocumentListItemResponse
            {
                DocumentId = d.DocumentId,
                DocumentName = d.DocumentName,
                Category = d.DocumentCategoryID,
                UploadDate = d.UploadDate,
                VisibleToInternal = d.VisibleToInternal,
                VisibleToExternal = d.VisibleToExternal,
                UploadedByName = u != null
                    ? (!string.IsNullOrWhiteSpace(u.FullName) ? u.FullName.Trim() : u.Username)
                    : null
            }
        ).ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved." });
        }

        var doc = await _dbContext.SystemDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.DocumentId == id);

        if (doc is null || !IsVisibleToRole(doc, user.Role))
        {
            return NotFound(new { Message = "Document not found." });
        }

        var physicalPath = ResolvePhysicalPath(doc.FileUrl);
        if (physicalPath is null || !System.IO.File.Exists(physicalPath))
        {
            return NotFound(new { Message = "Document file is missing on the server." });
        }

        var contentType = GetContentType(Path.GetExtension(physicalPath));
        var downloadName = SanitizeFileName(doc.DocumentName);
        if (string.IsNullOrWhiteSpace(Path.GetExtension(downloadName)))
        {
            downloadName += Path.GetExtension(physicalPath);
        }

        return PhysicalFile(physicalPath, contentType, downloadName);
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin")]
    [RequestSizeLimit(25_000_000)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile? file,
        [FromForm] string? documentName,
        [FromForm] string? category,
        [FromForm] bool visibleToInternal = false,
        [FromForm] bool visibleToExternal = false)
    {
        var user = await ResolveCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized(new { Message = "Authenticated user could not be resolved." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { Message = "A document file is required." });
        }

        if (!visibleToInternal && !visibleToExternal)
        {
            return BadRequest(new { Message = "Select at least one audience: Internal or External." });
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            return BadRequest(new { Message = "Allowed file types: PDF, DOCX, XLSX, PNG, JPEG." });
        }

        if (!string.IsNullOrWhiteSpace(file.ContentType) &&
            !AllowedContentTypes.Contains(file.ContentType) &&
            !file.ContentType.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { Message = "File content type is not allowed." });
        }

        var displayName = string.IsNullOrWhiteSpace(documentName)
            ? Path.GetFileNameWithoutExtension(file.FileName)
            : documentName.Trim();

        if (string.IsNullOrWhiteSpace(displayName))
        {
            return BadRequest(new { Message = "Document name is required." });
        }

        var categoryLabel = string.IsNullOrWhiteSpace(category) ? "General" : category.Trim();
        if (categoryLabel.Length > 100)
        {
            categoryLabel = categoryLabel[..100];
        }

        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadsRoot = Path.Combine(webRoot, "uploads", "documents");
        Directory.CreateDirectory(uploadsRoot);

        var safeOriginal = SanitizeFileName(Path.GetFileName(file.FileName));
        var storedName = $"{Guid.NewGuid():N}_{safeOriginal}";
        var physicalPath = Path.Combine(uploadsRoot, storedName);

        await using (var stream = System.IO.File.Create(physicalPath))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/documents/{storedName}";

        var entity = new SystemDocument
        {
            DocumentName = displayName.Length > 255 ? displayName[..255] : displayName,
            DocumentCategoryID = categoryLabel,
            FileUrl = relativeUrl,
            UploadedBy = user.UserId,
            UploadDate = DateTime.UtcNow,
            VisibleToInternal = visibleToInternal,
            VisibleToExternal = visibleToExternal
        };

        _dbContext.SystemDocuments.Add(entity);
        await _dbContext.SaveChangesAsync();

        return StatusCode(StatusCodes.Status201Created, new DocumentListItemResponse
        {
            DocumentId = entity.DocumentId,
            DocumentName = entity.DocumentName,
            Category = entity.DocumentCategoryID,
            UploadDate = entity.UploadDate,
            VisibleToInternal = entity.VisibleToInternal,
            VisibleToExternal = entity.VisibleToExternal,
            UploadedByName = !string.IsNullOrWhiteSpace(user.FullName) ? user.FullName.Trim() : user.Username
        });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<IActionResult> Delete(int id)
    {
        var doc = await _dbContext.SystemDocuments.FirstOrDefaultAsync(d => d.DocumentId == id);
        if (doc is null)
        {
            return NotFound(new { Message = "Document not found." });
        }

        var physicalPath = ResolvePhysicalPath(doc.FileUrl);
        _dbContext.SystemDocuments.Remove(doc);
        await _dbContext.SaveChangesAsync();

        if (physicalPath is not null && System.IO.File.Exists(physicalPath))
        {
            try
            {
                System.IO.File.Delete(physicalPath);
            }
            catch
            {
                // DB row is gone; orphaned file is acceptable.
            }
        }

        return Ok(new { Message = "Document deleted." });
    }

    private static bool IsExternalRole(string? role) =>
        string.Equals(role, UserConstants.RoleBidder, StringComparison.OrdinalIgnoreCase);

    private static bool IsVisibleToRole(SystemDocument doc, string? role) =>
        IsExternalRole(role) ? doc.VisibleToExternal : doc.VisibleToInternal;

    private string? ResolvePhysicalPath(string fileUrl)
    {
        if (string.IsNullOrWhiteSpace(fileUrl))
        {
            return null;
        }

        var relative = fileUrl.Replace('\\', '/').TrimStart('/');
        if (!relative.StartsWith("uploads/documents/", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads", "documents"));
        var physicalPath = Path.GetFullPath(Path.Combine(webRoot, relative.Replace('/', Path.DirectorySeparatorChar)));

        if (!physicalPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return physicalPath;
    }

    private static string SanitizeFileName(string name)
    {
        var cleaned = Regex.Replace(Path.GetFileName(name) ?? "document", @"[^\w\-. ]+", "_").Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
    }

    private static string GetContentType(string extension) => extension.ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        _ => "application/octet-stream"
    };

    private async Task<User?> ResolveCurrentUserAsync()
    {
        foreach (var claim in User.Claims)
        {
            var isIdClaim =
                claim.Type == ClaimTypes.NameIdentifier ||
                claim.Type == "nameid" ||
                claim.Type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase);

            if (!isIdClaim)
            {
                continue;
            }

            if (int.TryParse(claim.Value, out var userId))
            {
                var byId = await _dbContext.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                if (byId is not null)
                {
                    return byId;
                }
            }
        }

        var candidates = new List<string>();
        foreach (var claim in User.Claims)
        {
            if (claim.Type is
                    ClaimTypes.Name or
                    ClaimTypes.Email or
                    JwtRegisteredClaimNames.Sub or
                    JwtRegisteredClaimNames.UniqueName or
                    JwtRegisteredClaimNames.Email or
                    "sub" or
                    "unique_name" or
                    "email" ||
                claim.Type == ClaimTypes.NameIdentifier ||
                claim.Type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(claim.Value) && !int.TryParse(claim.Value, out _))
                {
                    candidates.Add(claim.Value.Trim());
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(User.Identity?.Name))
        {
            candidates.Add(User.Identity.Name.Trim());
        }

        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var normalized = candidate.ToLowerInvariant();
            var found = await _dbContext.Users.FirstOrDefaultAsync(u =>
                u.Username.ToLower() == normalized ||
                u.Email.ToLower() == normalized ||
                (u.UserPrincipalName != null && u.UserPrincipalName.ToLower() == normalized));

            if (found is not null)
            {
                return found;
            }
        }

        return null;
    }
}
