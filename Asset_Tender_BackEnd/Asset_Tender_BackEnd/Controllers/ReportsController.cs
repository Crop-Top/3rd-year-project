using Asset_Tender_BackEnd.Models.Responses;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "SuperAdmin")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(IReportService reportService, ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet("{reportType}")]
    public async Task<ActionResult<ReportResponse>> GetReport(
        string reportType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRequest(reportType, startDate, endDate);
        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        try
        {
            var generatedBy = GetGeneratedBy();
            var report = await _reportService.GenerateAsync(
                reportType,
                startDate,
                endDate,
                generatedBy,
                cancellationToken);
            return Ok(report);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate report {ReportType}.", reportType);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                Message = "Report generation failed. Please try a narrower date range or contact support."
            });
        }
    }

    [HttpGet("{reportType}/export.csv")]
    public async Task<IActionResult> ExportCsv(
        string reportType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRequest(reportType, startDate, endDate);
        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        try
        {
            var generatedBy = GetGeneratedBy();
            var report = await _reportService.GenerateAsync(
                reportType,
                startDate,
                endDate,
                generatedBy,
                cancellationToken);

            var bytes = ReportCsvWriter.ToBytes(report);
            var fileName = $"{reportType}-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv";
            return File(bytes, "text/csv", fileName);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export report {ReportType} as CSV.", reportType);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                Message = "CSV export failed. Please try a narrower date range or contact support."
            });
        }
    }

    private string GetGeneratedBy()
    {
        return User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("email")
            ?? "SuperAdmin";
    }

    private static string? ValidateRequest(string reportType, DateTime? startDate, DateTime? endDate)
    {
        if (RequiresDateRange(reportType) && (startDate is null || endDate is null))
        {
            return "Start date and end date are required for this report.";
        }

        if (startDate > endDate)
        {
            return "Start date must be on or before end date.";
        }

        return null;
    }

    private static bool RequiresDateRange(string reportType) =>
        !string.Equals(reportType, "user-summary", StringComparison.OrdinalIgnoreCase)
        && !string.Equals(reportType, "expired-unsold", StringComparison.OrdinalIgnoreCase);
}
