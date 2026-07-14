using Asset_Tender_BackEnd.Models.Data;
using Asset_Tender_BackEnd.Configuration;
using Asset_Tender_BackEnd.Services;
using Microsoft.EntityFrameworkCore;
using DotNetEnv;

Env.Load();

var builder = WebApplication.CreateBuilder(args);

// =====================
// SERVICES (REGISTER HERE)
// =====================

// DB connection (.env or appsettings)
var connectionstring = Environment.GetEnvironmentVariable("DB_CONNECTION")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

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

// Controllers
builder.Services.AddControllers();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (MUST BE BEFORE Build)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// =====================
// MIDDLEWARE (AFTER BUILD)
// =====================

// Swagger
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CORS (MUST BE HERE)
app.UseCors("AllowAll");

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();