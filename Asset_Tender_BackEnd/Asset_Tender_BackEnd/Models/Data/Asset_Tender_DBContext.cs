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
        public DbSet<Bid> Bids { get; set; }
        public DbSet<Invoice> Invoices { get; set; }
        public DbSet<SystemDocument> SystemDocuments { get; set; }
        public DbSet<TenderListing> TenderListings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // 🛠️ FIXING THE SCHEMATIC AND ENTITY SCHEMA CRASH
            modelBuilder.Entity<User>(entity =>
            {
                // 1. Force EF Core to look for schema "Security" and table "Users"
                entity.ToTable("Users", schema: "Security");

                // 2. Primary Key Mapping
                entity.HasKey(e => e.UserId);
                entity.Property(e => e.UserId).HasColumnName("UserID");

                // 3. Match explicit DB Column names if they differ from properties
                entity.Property(e => e.ProfilePhotoUrl).HasColumnName("ProfilePhotoURL");

                // 4. If your User.cs model property name differs from your database column:
                // mapping 'IdentityType' property to the 'IdentityProviderID' column found in your SELECT layout
                entity.Property(e => e.IdentityType).HasColumnName("IdentityProviderID");
            });

            modelBuilder.Entity<Asset>(entity =>
            {
                entity.HasOne(a => a.UploadedByNavigation)
                    .WithMany(u => u.AssetUploadedByNavigations)
                    .HasForeignKey(a => a.UploadedBy)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(a => a.ApprovedByNavigation)
                    .WithMany(u => u.AssetApprovedByNavigations)
                    .HasForeignKey(a => a.ApprovedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Invoice>(entity =>
            {
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
                entity.HasKey(e => e.DocumentId);

                entity.HasOne(d => d.UploadedByNavigation)
                    .WithMany(u => u.SystemDocuments)
                    .HasForeignKey(d => d.UploadedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<TenderListing>(entity =>
            {
                // PRIMARY KEY
                entity.HasKey(t => t.ListingId);

                // TABLE NAME (optional but good practice if DB matches)
                entity.ToTable("TenderListing");

                // REQUIRED RELATION: TenderListing -> Asset
                entity.HasOne(t => t.Asset)
                    .WithMany(a => a.TenderListings)
                    .HasForeignKey(t => t.AssetId)
                    .OnDelete(DeleteBehavior.Cascade);

                // OPTIONAL: Bids relationship (if Bid has TenderListingId FK)
                entity.HasMany(t => t.Bids)
                    .WithOne()
                    .HasForeignKey("ListingId") // only if Bid uses ListingId FK
                    .OnDelete(DeleteBehavior.Cascade);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}