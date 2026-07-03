using Asset_Tender_BackEnd.Models.Requests;
using Asset_Tender_BackEnd.Services;
using Microsoft.AspNetCore.Mvc;

namespace Asset_Tender_BackEnd.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IActiveDirectoryService _activeDirectoryService;

    public AuthController(IActiveDirectoryService activeDirectoryService)
    {
        _activeDirectoryService = activeDirectoryService;
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