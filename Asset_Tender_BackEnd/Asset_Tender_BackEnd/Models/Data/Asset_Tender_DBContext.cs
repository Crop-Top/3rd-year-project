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
        public DbSet<Inventory> Assets { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<AssetCondition> AssetConditions { get; set; }
        public DbSet<AssetStatus> AssetStatuses { get; set; }
        public DbSet<TenderStatus> TenderStatuses { get; set; }
        public DbSet<Bid> Bids { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<SystemDocument> SystemDocuments { get; set; }
        public DbSet<TenderListing> TenderListings { get; set; }
        public DbSet<AssetImage> AssetImages { get; set; }
        public DbSet<ProofOfPayment> ProofOfPayments { get; set; }
        public DbSet<PaymentStatus> PaymentStatuses { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Inventory>(entity =>
            {
                entity.ToTable("Inventory", DatabaseSchemas.Assets);

                entity.HasKey(e => e.AssetId);
                entity.Property(e => e.AssetId).HasColumnName("AssetID");
                entity.Property(e => e.AssetName).HasMaxLength(300);
                entity.Property(e => e.BarcodeSerial)
                    .HasMaxLength(200)
                    .HasColumnName("Barcode_Serial");
                entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
                entity.Property(e => e.DepartmentID).HasColumnName("DepartmentID");
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
                    .HasForeignKey(a => a.DepartmentID)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.UploadedByNavigation)
                    .WithMany(u => u.AssetUploadedByNavigations)
                    .HasForeignKey(a => a.UploadedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.ApprovedByNavigation)
                    .WithMany(u => u.AssetApprovedByNavigations)
                    .HasForeignKey(a => a.ApprovedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.AssetImage)
                    .WithOne(i => i.Asset)
                    .HasForeignKey<AssetImage>(i => i.AssetId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<AssetImage>(entity =>
            {
                entity.ToTable("AssetImage", DatabaseSchemas.Assets);
                entity.HasKey(e => e.AssetImageId);
                entity.Property(e => e.ContentType).HasMaxLength(100);
                entity.Property(e => e.FileName).HasMaxLength(260);
                entity.Property(e => e.Data).HasColumnType("varbinary(max)");
                entity.HasIndex(e => e.AssetId).IsUnique();
            });

            modelBuilder.Entity<Category>(entity =>
            {
                entity.ToTable("Categories", DatabaseSchemas.Assets);
                entity.HasKey(e => e.CategoryId);
                entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
                entity.Property(e => e.CategoryName).HasMaxLength(300);
                entity.Property(e => e.ParentCategoryID).HasColumnName("ParentCategoryID");
            });

            modelBuilder.Entity<Department>(entity =>
            {
                entity.ToTable("Departments", DatabaseSchemas.Assets);
                entity.HasKey(e => e.DepartmentID);
                entity.Property(e => e.DepartmentID).HasColumnName("DepartmentID");
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

            modelBuilder.Entity<PaymentStatus>(entity =>
            {
                entity.ToTable("PaymentStatus", DatabaseSchemas.Lookup);
                entity.HasKey(e => e.PaymentStatusId);
                entity.Property(e => e.PaymentStatusId).HasColumnName("PaymentStatusID");
                entity.Property(e => e.StatusName).HasMaxLength(50);
                entity.Property(e => e.Description).HasMaxLength(255);
            });

            modelBuilder.Entity<Bid>(entity =>
            {
                entity.ToTable("Bids", DatabaseSchemas.Tender);
                entity.HasKey(e => e.BidId);

                entity.Property(e => e.BidId).HasColumnName("BidID");
                entity.Property(e => e.ListingId).HasColumnName("ListingID");
                entity.Property(e => e.BidderId).HasColumnName("BidderID");
                entity.Property(e => e.BidAmount).HasColumnType("decimal(18, 2)");

                entity.HasOne(d => d.Bidder)
                    .WithMany(p => p.Bids)
                    .HasForeignKey(d => d.BidderId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Listing)
                    .WithMany(p => p.Bids)
                    .HasForeignKey(d => d.ListingId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Invoice>(entity =>
            {
                entity.ToTable("Invoices", DatabaseSchemas.Tender);
                entity.HasKey(e => e.InvoiceId);
                entity.Property(e => e.InvoiceId).HasColumnName("InvoiceID");
                entity.Property(e => e.WinningBidId).HasColumnName("WinningBidID");
                entity.Property(e => e.BuyerId).HasColumnName("BuyerID");
                entity.Property(e => e.PaymentStatusId).HasColumnName("PaymentStatusID");
                entity.Property(e => e.InvoiceNumber).HasMaxLength(100);
                entity.Property(e => e.TotalAmount).HasColumnType("decimal(18, 2)");
                entity.Property(e => e.ProofOfPaymentUrl)
                    .HasMaxLength(2048)
                    .HasColumnName("ProofOfPaymentURL");

                entity.HasOne(i => i.Buyer)
                    .WithMany(u => u.InvoiceBuyers)
                    .HasForeignKey(i => i.BuyerId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(i => i.ReleasedByNavigation)
                    .WithMany(u => u.InvoiceReleasedByNavigations)
                    .HasForeignKey(i => i.ReleasedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(i => i.WinningBid)
                    .WithMany(b => b.Invoices)
                    .HasForeignKey(i => i.WinningBidId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(i => i.PaymentStatus)
                    .WithMany(s => s.Invoices)
                    .HasForeignKey(i => i.PaymentStatusId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(i => i.ProofOfPayment)
                    .WithOne(p => p.Invoice)
                    .HasForeignKey<ProofOfPayment>(p => p.InvoiceId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ProofOfPayment>(entity =>
            {
                entity.ToTable("ProofOfPayment", DatabaseSchemas.Tender);
                entity.HasKey(e => e.ProofOfPaymentId);
                entity.Property(e => e.InvoiceId).HasColumnName("InvoiceId");
                entity.Property(e => e.ContentType).HasMaxLength(100);
                entity.Property(e => e.FileName).HasMaxLength(260);
                entity.Property(e => e.Data).HasColumnType("varbinary(max)");
                entity.HasIndex(e => e.InvoiceId).IsUnique();
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
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users", DatabaseSchemas.Security);

                entity.Property(e => e.UserId).HasColumnName("UserID");
                entity.Property(e => e.IdentityProviderId).HasColumnName("IdentityProviderID");
                entity.Property(e => e.AdObjectGuid).HasColumnName("AD_ObjectGUID");
                entity.Property(e => e.EmployeeId).HasColumnName("EmployeeID");
                entity.Property(e => e.DepartmentID).HasColumnName("DepartmentID");

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
                entity.Property(e => e.ResetToken).HasMaxLength(256);
                entity.Property(e => e.EmailVerificationToken).HasMaxLength(256);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}