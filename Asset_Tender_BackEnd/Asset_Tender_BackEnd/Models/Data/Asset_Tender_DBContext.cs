using Asset_Tender_BackEnd.Constants;
using Asset_Tender_BackEnd.Models;
using Asset_Tender_BackEnd.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Models.Data
{
    public class Asset_Tender_DBContext : DbContext
    {
        public Asset_Tender_DBContext(DbContextOptions options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Asset> Assets { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<AssetCondition> AssetConditions { get; set; }
        public DbSet<AssetStatus> AssetStatuses { get; set; }
        public DbSet<TenderStatus> TenderStatuses { get; set; }
        public DbSet<Bid> Bids { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<SystemDocument> SystemDocuments { get; set; }
        public DbSet<TenderListing> TenderListings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Asset>(entity =>
            {
                entity.ToTable("Inventory", DatabaseSchemas.Assets);

                entity.HasKey(e => e.AssetId);
                entity.Property(e => e.AssetId).HasColumnName("AssetID");
                entity.Property(e => e.AssetName).HasMaxLength(300);
                entity.Property(e => e.BarcodeSerial)
                    .HasMaxLength(200)
                    .HasColumnName("Barcode_Serial");
                entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
                entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");
                entity.Property(e => e.CostCenter).HasMaxLength(100);
                entity.Property(e => e.Location).HasMaxLength(500);
                entity.Property(e => e.AssetConditionId).HasColumnName("AssetConditionID");
                entity.Property(e => e.ConditionNotes).HasColumnType("nvarchar(max)");
                entity.Property(e => e.ImageUrl)
                    .HasMaxLength(1000)
                    .HasColumnName("ImageURL");
                entity.Property(e => e.ReccomendedPrice)
                    .HasColumnType("decimal(18, 2)")
                    .HasColumnName("RecommendedPrice");
                entity.Property(e => e.AssetStatusId).HasColumnName("AssetStatusID");

                entity.HasOne(a => a.Category)
                    .WithMany(c => c.Assets)
                    .HasForeignKey(a => a.CategoryId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.Department)
                    .WithMany(d => d.Assets)
                    .HasForeignKey(a => a.DepartmentId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.UploadedByNavigation)
                    .WithMany(u => u.AssetUploadedByNavigations)
                    .HasForeignKey(a => a.UploadedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.ApprovedByNavigation)
                    .WithMany(u => u.AssetApprovedByNavigations)
                    .HasForeignKey(a => a.ApprovedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Category>(entity =>
            {
                entity.ToTable("Categories", DatabaseSchemas.Assets);
                entity.HasKey(e => e.CategoryId);
                entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
                entity.Property(e => e.CategoryName).HasMaxLength(300);
                entity.Property(e => e.ParentCategoryId).HasColumnName("ParentCategoryID");
            });

            modelBuilder.Entity<Department>(entity =>
            {
                entity.ToTable("Departments", DatabaseSchemas.Assets);
                entity.HasKey(e => e.DepartmentId);
                entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");
                entity.Property(e => e.DepartmentName).HasMaxLength(300);
            });

            modelBuilder.Entity<AssetCondition>(entity =>
            {
                entity.ToTable("AssetCondition", DatabaseSchemas.Lookup);
                entity.HasKey(e => e.AssetConditionId);
                entity.Property(e => e.AssetConditionId).HasColumnName("AssetConditionID");
                entity.Property(e => e.ConditionName).HasMaxLength(50);
            });

            modelBuilder.Entity<AssetStatus>(entity =>
            {
                entity.ToTable("AssetStatus", DatabaseSchemas.Lookup);
                entity.HasKey(e => e.AssetStatusId);
                entity.Property(e => e.AssetStatusId).HasColumnName("AssetStatusID");
                entity.Property(e => e.StatusName).HasMaxLength(50);
            });

            modelBuilder.Entity<TenderStatus>(entity =>
            {
                entity.ToTable("TenderStatus", DatabaseSchemas.Lookup);
                entity.HasKey(e => e.TenderStatusId);
                entity.Property(e => e.TenderStatusId).HasColumnName("TenderStatusID");
                entity.Property(e => e.StatusName).HasMaxLength(50);
            });

            modelBuilder.Entity<Bid>(entity =>
            {
                entity.ToTable("Bids", DatabaseSchemas.Tender);
            });

            modelBuilder.Entity<Invoice>(entity =>
            {
                entity.ToTable("Invoices", DatabaseSchemas.Tender);

                entity.HasOne(i => i.Buyer)
                    .WithMany(u => u.InvoiceBuyers)
                    .HasForeignKey(i => i.BuyerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(i => i.ReleasedByNavigation)
                    .WithMany(u => u.InvoiceReleasedByNavigations)
                    .HasForeignKey(i => i.ReleasedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<SystemDocument>(entity =>
            {
                entity.ToTable("SystemDocuments", DatabaseSchemas.Tender);
                entity.HasKey(e => e.DocumentId);

                entity.HasOne(d => d.UploadedByNavigation)
                    .WithMany(u => u.SystemDocuments)
                    .HasForeignKey(d => d.UploadedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<TenderListing>(entity =>
            {
                entity.HasKey(t => t.ListingId);
                entity.ToTable("Listings", DatabaseSchemas.Tender);

                entity.Property(e => e.ListingId).HasColumnName("ListingID");
                entity.Property(e => e.AssetId).HasColumnName("AssetID");
                entity.Property(e => e.StartingBid).HasColumnType("decimal(18, 2)");
                entity.Property(e => e.TenderStatusId).HasColumnName("TenderStatusID");

                entity.HasOne(t => t.Asset)
                    .WithMany(a => a.TenderListings)
                    .HasForeignKey(t => t.AssetId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasMany(t => t.Bids)
                    .WithOne()
                    .HasForeignKey("ListingId")
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users", DatabaseSchemas.Security);

                entity.Property(e => e.UserId).HasColumnName("UserID");
                entity.Property(e => e.IdentityProviderId).HasColumnName("IdentityProviderID");
                entity.Property(e => e.AdObjectGuid).HasColumnName("AD_ObjectGUID");
                entity.Property(e => e.EmployeeId).HasColumnName("EmployeeID");
                entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");

                entity.HasIndex(e => e.Username).IsUnique();
                entity.HasIndex(e => e.Email).IsUnique();

                entity.Property(e => e.AccountStatus)
                    .HasMaxLength(50)
                    .HasDefaultValue("Pending");
                entity.Property(e => e.CompanyName).HasMaxLength(150);
                entity.Property(e => e.Email).HasMaxLength(255);
                entity.Property(e => e.FullName).HasMaxLength(150);
                entity.Property(e => e.PasswordHash).HasMaxLength(255);
                entity.Property(e => e.Role).HasMaxLength(50);
                entity.Property(e => e.Username).HasMaxLength(100);
                entity.Property(e => e.FirstName).HasMaxLength(100);
                entity.Property(e => e.LastName).HasMaxLength(100);
                entity.Property(e => e.UserPrincipalName).HasMaxLength(255);
                entity.Property(e => e.EmployeeId).HasMaxLength(50);
                entity.Property(e => e.JobTitle).HasMaxLength(150);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}