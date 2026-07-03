using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Asset_Tender_BackEnd.Models.Entities;

public partial class AssetPortalContext : DbContext
{
    public AssetPortalContext()
    {
    }

    public AssetPortalContext(DbContextOptions<AssetPortalContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Asset> Assets { get; set; }

    public virtual DbSet<Bid> Bids { get; set; }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Department> Departments { get; set; }

    public virtual DbSet<Invoice> Invoices { get; set; }

    public virtual DbSet<SystemDocument> SystemDocuments { get; set; }

    public virtual DbSet<TenderListing> TenderListings { get; set; }

    public virtual DbSet<User> Users { get; set; }

         //protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
         //#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
         //=> optionsBuilder.UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=GRP-03-15;Trusted_Connection=True;TrustServerCertificate=True;");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Asset>(entity =>
        {
            entity.HasKey(e => e.AssetId).HasName("PK__ASSETS__43492372909C95FD");

            entity.ToTable("ASSETS");

            entity.HasIndex(e => e.BarcodeSerial, "UQ_Assets_BarcodeSerial")
                .IsUnique()
                .HasFilter("([Barcode_Serial] IS NOT NULL)");

            entity.Property(e => e.AssetId).HasColumnName("AssetID");
            entity.Property(e => e.AssetName).HasMaxLength(200);
            entity.Property(e => e.BarcodeSerial)
                .HasMaxLength(100)
                .HasColumnName("Barcode_Serial");
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.ConditionGrade).HasMaxLength(50);
            entity.Property(e => e.ConditionNotes).HasColumnType("text");
            entity.Property(e => e.CostCenter).HasMaxLength(50);
            entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");
            entity.Property(e => e.ImageUrl)
                .HasMaxLength(2048)
                .HasColumnName("ImageURL");
            entity.Property(e => e.Location).HasMaxLength(255);
            entity.Property(e => e.ReccomendedPrice).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValue("Pending");

            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.AssetApprovedByNavigations)
                .HasForeignKey(d => d.ApprovedBy)
                .HasConstraintName("FK_Assets_ApprovedBy");

            entity.HasOne(d => d.Category).WithMany(p => p.Assets)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Assets_Categories");

            entity.HasOne(d => d.Department).WithMany(p => p.Assets)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Assets_Departments");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.AssetUploadedByNavigations)
                .HasForeignKey(d => d.UploadedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Assets_UploadedBy");
        });

        modelBuilder.Entity<Bid>(entity =>
        {
            entity.HasKey(e => e.BidId).HasName("PK__BIDS__4A733DB276D1B71F");

            entity.ToTable("BIDS");

            entity.Property(e => e.BidId).HasColumnName("BidID");
            entity.Property(e => e.BidAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BidTimestamp).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.BidderId).HasColumnName("BidderID");
            entity.Property(e => e.ListingId).HasColumnName("ListingID");

            entity.HasOne(d => d.Bidder).WithMany(p => p.Bids)
                .HasForeignKey(d => d.BidderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bids_Users");

            entity.HasOne(d => d.Listing).WithMany(p => p.Bids)
                .HasForeignKey(d => d.ListingId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bids_Listings");
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryId).HasName("PK__CATEGORI__19093A2B55ACC5AC");

            entity.ToTable("CATEGORIES");

            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.CategoryName).HasMaxLength(100);
            entity.Property(e => e.ParentCategoryId).HasColumnName("ParentCategoryID");

            entity.HasOne(d => d.ParentCategory).WithMany(p => p.InverseParentCategory)
                .HasForeignKey(d => d.ParentCategoryId)
                .HasConstraintName("FK_Categories_Parent");
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasKey(e => e.DepartmentId).HasName("PK__DEPARTME__B2079BCD99163B31");

            entity.ToTable("DEPARTMENTS");

            entity.Property(e => e.DepartmentId).HasColumnName("DepartmentID");
            entity.Property(e => e.DepartmentName).HasMaxLength(100);
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasKey(e => e.InvoiceId).HasName("PK__INVOICES__D796AAD56C4393AF");

            entity.ToTable("INVOICES");

            entity.Property(e => e.InvoiceId).HasColumnName("InvoiceID");
            entity.Property(e => e.BuyerId).HasColumnName("BuyerID");
            entity.Property(e => e.PaymentStatus)
                .HasMaxLength(50)
                .HasDefaultValue("Pending PoP");
            entity.Property(e => e.ProofOfPaymentUrl)
                .HasMaxLength(2048)
                .HasColumnName("ProofOfPaymentURL");
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.WinningBidId).HasColumnName("WinningBidID");

            entity.HasOne(d => d.Buyer).WithMany(p => p.InvoiceBuyers)
                .HasForeignKey(d => d.BuyerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Invoices_Buyer");

            entity.HasOne(d => d.ReleasedByNavigation).WithMany(p => p.InvoiceReleasedByNavigations)
                .HasForeignKey(d => d.ReleasedBy)
                .HasConstraintName("FK_Invoices_ReleasedBy");

            entity.HasOne(d => d.WinningBid).WithMany(p => p.Invoices)
                .HasForeignKey(d => d.WinningBidId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Invoices_Bids");
        });

        modelBuilder.Entity<SystemDocument>(entity =>
        {
            entity.HasKey(e => e.DocumentId).HasName("PK__SYSTEM_D__1ABEEF6F54697DC3");

            entity.ToTable("SYSTEM_DOCUMENTS");

            entity.Property(e => e.DocumentId).HasColumnName("DocumentID");
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.DocumentName).HasMaxLength(255);
            entity.Property(e => e.FileUrl)
                .HasMaxLength(2048)
                .HasColumnName("FileURL");
            entity.Property(e => e.UploadDate).HasDefaultValueSql("(getdate())");

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.SystemDocuments)
                .HasForeignKey(d => d.UploadedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SysDocs_Users");
        });

        modelBuilder.Entity<TenderListing>(entity =>
        {
            entity.HasKey(e => e.ListingId).HasName("PK__TENDER_L__BF3EBEF09788D40B");

            entity.ToTable("TENDER_LISTINGS");

            entity.Property(e => e.ListingId).HasColumnName("ListingID");
            entity.Property(e => e.AssetId).HasColumnName("AssetID");
            entity.Property(e => e.StartingBid).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.Asset).WithMany(p => p.TenderListings)
                .HasForeignKey(d => d.AssetId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Tenders_Assets");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK__USERS__1788CCAC58709954");

            entity.ToTable("USERS");

            entity.HasIndex(e => e.Username, "UQ__USERS__536C85E41F656047").IsUnique();

            entity.HasIndex(e => e.Email, "UQ__USERS__A9D10534319E0690").IsUnique();

            entity.Property(e => e.UserId).HasColumnName("UserID");
            entity.Property(e => e.AccountStatus)
                .HasMaxLength(50)
                .HasDefaultValue("Pending");
            entity.Property(e => e.CompanyName).HasMaxLength(150);
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.FullName).HasMaxLength(150);
            entity.Property(e => e.IdentityType).HasMaxLength(20);
            entity.Property(e => e.PasswordHash).HasMaxLength(255);
            entity.Property(e => e.ProfilePhotoUrl)
                .HasMaxLength(2048)
                .HasColumnName("ProfilePhotoURL");
            entity.Property(e => e.Role).HasMaxLength(50);
            entity.Property(e => e.Username).HasMaxLength(100);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
