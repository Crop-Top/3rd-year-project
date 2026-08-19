using Asset_Tender_BackEnd.Configuration;
using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Models.Settings;
using Asset_Tender_BackEnd.Services;
using Asset_Tender_BackEnd.Worker;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// SERVICES REGISTRATION
// ==========================================

// 1. Connection String Setup
var connectionstring = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DB_CONNECTION")
    ?? throw new InvalidOperationException("Database connection string is missing.");

if (string.IsNullOrWhiteSpace(connectionstring))
{
    throw new InvalidOperationException(
        "Database connection is not configured. Set DB_CONNECTION in .env or ConnectionStrings:DefaultConnection in appsettings.");
}

builder.Services.AddDbContext<Asset_Tender_DBContext>(options =>
    options.UseSqlServer(connectionstring));

builder.Services.Configure<ActiveDirectorySettings>(
    builder.Configuration.GetSection("ActiveDirectory"));

builder.Services.AddScoped<IActiveDirectoryService, ActiveDirectoryService>();
builder.Services.AddScoped<IPasswordHasherService, PasswordHasherService>();
builder.Services.AddHttpClient<CaptchaService>();

builder.Services.AddMemoryCache();
builder.Services.AddControllers();

// 1. Bind configuration section to NmuApiSettings class
builder.Services.Configure<NmuApiSettings>(builder.Configuration.GetSection("NmuApiSettings"));

// 2. Register HttpClient
builder.Services.AddHttpClient();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the accessToken from POST /api/Auth/login (Swagger adds the 'Bearer ' prefix automatically)."
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

// 2. Updated CORS Policy to support production domain & local dev
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
                    "http://localhost:3000",
                    "https://soit-iis.mandela.ac.za"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// 3. JWT Authentication Setup
var jwtSecret = builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JWT Secret Key configuration is missing.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "AssetTenderBackend",
        ValidAudience = builder.Configuration["JwtSettings:Audience"] ?? "AssetTenderFrontEnd",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero,
        NameClaimType = JwtRegisteredClaimNames.Sub,
        RoleClaimType = ClaimTypes.Role
    };
});

// 4. Background Workers & Email Service
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHostedService<TenderClosingWorker>();
builder.Services.AddHostedService<TenderExpirationWorker>();

var app = builder.Build();

// ==========================================
// MIDDLEWARE PIPELINE
// ==========================================

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

// Note: If running behind IIS reverse proxy, static files must come before authorization
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// 👈 CRITICAL: SPA Fallback Route for React (prevents 404s on page refresh/direct URLs)
app.MapFallbackToFile("index.html");

app.Run();