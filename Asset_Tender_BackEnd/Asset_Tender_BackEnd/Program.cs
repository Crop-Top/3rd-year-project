using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Configuration;
using Asset_Tender_BackEnd.Services;
using Microsoft.EntityFrameworkCore;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// SERVICES REGISTRATION
// ==========================================

// DB Connection
var connectionstring = Environment.GetEnvironmentVariable("DB_CONNECTION");
builder.Services.AddDbContext<Asset_Tender_DBContext>(options =>
    options.UseSqlServer(connectionstring));

// Active Directory Config
builder.Services.Configure<ActiveDirectorySettings>(
    builder.Configuration.GetSection("ActiveDirectory"));
builder.Services.AddScoped<IActiveDirectoryService, ActiveDirectoryService>();

// Base Controllers
builder.Services.AddControllers();

// Swagger (Reset to original, simple baseline)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS Configurations
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// JWT Security Validation Engine
var jwtSecret = builder.Configuration["JwtSettings:Secret"]
    ?? throw new InvalidOperationException("JWT Secret Key configuration is missing.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "AssetTenderBackend",
        ValidAudience = builder.Configuration["JwtSettings:Audience"] ?? "AssetTenderFrontEnd",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };
});

var app = builder.Build();

// ==========================================
// MIDDLEWARE PIPELINE EXECUTION
// ==========================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseHttpsRedirection();

// Middlewares required for [Authorize] attributes to work
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();