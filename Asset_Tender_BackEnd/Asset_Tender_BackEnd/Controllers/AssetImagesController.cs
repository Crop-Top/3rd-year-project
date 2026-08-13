using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/assets")]
public class AssetImagesController : ControllerBase
{
    private readonly Asset_Tender_DBContext _dbContext;
    private readonly IWebHostEnvironment _environment;

    public AssetImagesController(Asset_Tender_DBContext dbContext, IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _environment = environment;
    }

    /// <summary>
    /// Serves asset images for &lt;img&gt; tags (no JWT on image requests).
    /// </summary>
    [HttpGet("{assetId:int}/image")]
    [AllowAnonymous]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetImage(int assetId)
    {
        var image = await _dbContext.AssetImages
            .AsNoTracking()
            .Where(i => i.AssetId == assetId)
            .Select(i => new { i.ContentType, i.Data, i.FileName })
            .FirstOrDefaultAsync();

        if (image is not null)
        {
            return File(image.Data, image.ContentType, enableRangeProcessing: false);
        }

        // Legacy fallback: disk path still on Inventory.ImageURL
        var asset = await _dbContext.Assets
            .AsNoTracking()
            .Where(a => a.AssetId == assetId)
            .Select(a => new { a.ImageUrl })
            .FirstOrDefaultAsync();

        if (asset?.ImageUrl is null)
        {
            return NotFound();
        }

        var relative = asset.ImageUrl.TrimStart('/');
        if (!relative.StartsWith("uploads/assets/", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound();
        }

        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var physicalPath = Path.GetFullPath(Path.Combine(webRoot, relative.Replace('/', Path.DirectorySeparatorChar)));
        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads", "assets"));
        if (!physicalPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase) ||
            !System.IO.File.Exists(physicalPath))
        {
            return NotFound();
        }

        var contentType = physicalPath.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
            ? "image/png"
            : "image/jpeg";

        return PhysicalFile(physicalPath, contentType);
    }

    /// <summary>
    /// One-shot: import existing wwwroot/uploads/assets files into Assets.AssetImage
    /// and rewrite Inventory.ImageURL to the API path.
    /// </summary>
    [HttpPost("migrate-images")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<object>> MigrateDiskImages()
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var uploadsRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads", "assets"));
        var candidates = await _dbContext.Assets
            .Where(a => a.ImageUrl != null && a.ImageUrl.StartsWith("/uploads/assets/"))
            .ToListAsync();

        var existingAssetIds = await _dbContext.AssetImages
            .Select(i => i.AssetId)
            .ToListAsync();
        var existing = existingAssetIds.ToHashSet();

        var migrated = 0;
        var skipped = 0;
        var missing = 0;

        foreach (var asset in candidates)
        {
            if (existing.Contains(asset.AssetId))
            {
                asset.ImageUrl = $"/assets/{asset.AssetId}/image";
                skipped++;
                continue;
            }

            var relative = asset.ImageUrl!.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var physicalPath = Path.GetFullPath(Path.Combine(webRoot, relative));
            if (!physicalPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase) ||
                !System.IO.File.Exists(physicalPath))
            {
                missing++;
                continue;
            }

            var bytes = await System.IO.File.ReadAllBytesAsync(physicalPath);
            var fileName = Path.GetFileName(physicalPath);
            var contentType = fileName.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                ? "image/png"
                : "image/jpeg";

            _dbContext.AssetImages.Add(new AssetImage
            {
                AssetId = asset.AssetId,
                ContentType = contentType,
                FileName = fileName,
                Data = bytes,
                UploadedAt = DateTime.UtcNow
            });
            asset.ImageUrl = $"/assets/{asset.AssetId}/image";
            migrated++;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            Message = "Disk image migration complete.",
            Migrated = migrated,
            AlreadyInDb = skipped,
            MissingFiles = missing
        });
    }
}
