-- Seed departments, categories, and status/condition lookups used by Create Tender.
-- Live schema: Assets.Departments, Assets.Categories, Lookup.AssetCondition,
-- Lookup.AssetStatus, Lookup.TenderStatus
-- Run against grp-03-15.

------------------------------------------------------------
-- Departments (Assets schema)
------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Faculty of Science')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Faculty of Science');

IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Faculty of Engineering')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Faculty of Engineering');

IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Faculty of Business and Economic Sciences')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Faculty of Business and Economic Sciences');

IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Faculty of Health Sciences')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Faculty of Health Sciences');

IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Facilities and Estates')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Facilities and Estates');

IF NOT EXISTS (SELECT 1 FROM Assets.Departments WHERE DepartmentName = N'Information and Communication Technology')
    INSERT INTO Assets.Departments (DepartmentName) VALUES (N'Information and Communication Technology');

------------------------------------------------------------
-- Categories (Assets schema)
------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'IT Equipment')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'IT Equipment', 1);

IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'Furniture')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'Furniture', 2);

IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'Vehicles')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'Vehicles', 3);

IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'Laboratory Equipment')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'Laboratory Equipment', 4);

IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'Machinery and Tools')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'Machinery and Tools', 5);

IF NOT EXISTS (SELECT 1 FROM Assets.Categories WHERE CategoryName = N'Office Equipment')
    INSERT INTO Assets.Categories (CategoryName, DisplayOrder) VALUES (N'Office Equipment', 6);

------------------------------------------------------------
-- Asset conditions (matches Create Tender dropdown)
------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Lookup.AssetCondition WHERE ConditionName = N'Excellent')
    INSERT INTO Lookup.AssetCondition (ConditionName, DisplayOrder) VALUES (N'Excellent', 1);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetCondition WHERE ConditionName = N'Good')
    INSERT INTO Lookup.AssetCondition (ConditionName, DisplayOrder) VALUES (N'Good', 2);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetCondition WHERE ConditionName = N'Fair')
    INSERT INTO Lookup.AssetCondition (ConditionName, DisplayOrder) VALUES (N'Fair', 3);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetCondition WHERE ConditionName = N'Poor')
    INSERT INTO Lookup.AssetCondition (ConditionName, DisplayOrder) VALUES (N'Poor', 4);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetCondition WHERE ConditionName = N'For Parts Only')
    INSERT INTO Lookup.AssetCondition (ConditionName, DisplayOrder) VALUES (N'For Parts Only', 5);

------------------------------------------------------------
-- Asset statuses
------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Lookup.AssetStatus WHERE StatusName = N'Pending')
    INSERT INTO Lookup.AssetStatus (StatusName, DisplayOrder, IsActive) VALUES (N'Pending', 1, 1);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetStatus WHERE StatusName = N'Active')
    INSERT INTO Lookup.AssetStatus (StatusName, DisplayOrder, IsActive) VALUES (N'Active', 2, 1);

IF NOT EXISTS (SELECT 1 FROM Lookup.AssetStatus WHERE StatusName = N'Rejected')
    INSERT INTO Lookup.AssetStatus (StatusName, DisplayOrder, IsActive) VALUES (N'Rejected', 3, 1);

------------------------------------------------------------
-- Tender statuses (Listings.TenderStatusID defaults to 1)
------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Lookup.TenderStatus WHERE StatusName = N'Pending')
    INSERT INTO Lookup.TenderStatus (StatusName, DisplayOrder) VALUES (N'Pending', 0);

IF NOT EXISTS (SELECT 1 FROM Lookup.TenderStatus WHERE StatusName = N'Open')
    INSERT INTO Lookup.TenderStatus (StatusName, DisplayOrder) VALUES (N'Open', 1);

IF NOT EXISTS (SELECT 1 FROM Lookup.TenderStatus WHERE StatusName = N'Closed')
    INSERT INTO Lookup.TenderStatus (StatusName, DisplayOrder) VALUES (N'Closed', 2);

IF NOT EXISTS (SELECT 1 FROM Lookup.TenderStatus WHERE StatusName = N'Cancelled')
    INSERT INTO Lookup.TenderStatus (StatusName, DisplayOrder) VALUES (N'Cancelled', 3);

PRINT 'Lookup seed completed.';
