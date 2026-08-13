import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/admin_style/CreateTenderPage.css";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

import {
  createCategory,
  createTender,
  getCategories,
  getDepartments,
} from "../../services/tenderService";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "For Parts Only"];

function parseMoney(value) {
  if (!value || typeof value !== "string") return NaN;
  return Number(value.replace(/,/g, "").trim());
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function CreateTenderPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    assetName: "",
    barcode: "",
    departmentId: "",
    costCenter: "",
    location: "",
    categoryId: "",
    condition: "",
    notes: "",
    purchasePrice: "",
    startingBid: "",
    startTime: "",
    endTime: "",
  });

  const [image, setImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [lookupsError, setLookupsError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [startingBidTouched, setStartingBidTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        const [cats, depts] = await Promise.all([
          getCategories(),
          getDepartments(),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setDepartments(depts);
        setLookupsError("");
      } catch (err) {
        if (!cancelled) {
          setLookupsError(err.message || "Failed to load lookup data.");
        }
      }
    }

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "purchasePrice" && !startingBidTouched) {
        const purchase = parseMoney(value);
        if (Number.isFinite(purchase) && purchase > 0) {
          next.startingBid = formatMoney(purchase * 0.05);
        }
      }

      if (field === "startingBid") {
        setStartingBidTouched(true);
      }

      return next;
    });
  };

  const openAddCategory = () => {
    setIsAddingCategory(true);
    setNewCategoryName("");
    setCategoryError("");
  };

  const closeAddCategory = () => {
    setIsAddingCategory(false);
    setNewCategoryName("");
    setCategoryError("");
  };

  const confirmAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError("Enter a category name.");
      return;
    }

    const alreadyExists = categories.some(
      (cat) => cat.categoryName.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setCategoryError("That category already exists.");
      return;
    }

    try {
      const created = await createCategory(trimmed);
      setCategories((prev) =>
        [...prev, created].sort((a, b) =>
          a.categoryName.localeCompare(b.categoryName)
        )
      );
      setFormData((prev) => ({
        ...prev,
        categoryId: String(created.categoryId),
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.categoryId;
        return next;
      });
      closeAddCategory();
    } catch (err) {
      setCategoryError(err.message || "Failed to create category.");
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    setImage(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const validate = () => {
    const next = {};
    if (!formData.assetName.trim()) next.assetName = "Enter an asset name.";
    if (!formData.departmentId) next.departmentId = "Select a department.";
    if (!formData.costCenter.trim()) next.costCenter = "Enter a cost center.";
    if (!formData.location.trim()) next.location = "Enter a location.";
    if (!formData.categoryId) next.categoryId = "Select an asset category.";
    if (!formData.condition) next.condition = "Select a condition grade.";

    const purchase = parseMoney(formData.purchasePrice);
    if (!Number.isFinite(purchase) || purchase <= 0) {
      next.purchasePrice = "Enter the original purchase price from ERP.";
    }

    const startingBid = parseMoney(formData.startingBid);
    if (!Number.isFinite(startingBid) || startingBid <= 0) {
      next.startingBid = "Enter a starting bid.";
    }

    if (!formData.startTime) next.startTime = "Set a tender start time.";
    if (!formData.endTime) next.endTime = "Set a tender end time.";
    if (
      formData.startTime &&
      formData.endTime &&
      new Date(formData.endTime) <= new Date(formData.startTime)
    ) {
      next.endTime = "End time must be after the start time.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    const payload = new FormData();
    payload.append("assetName", formData.assetName.trim());
    if (formData.barcode.trim()) {
      payload.append("barcodeSerial", formData.barcode.trim());
    }
    payload.append("departmentId", formData.departmentId);
    payload.append("categoryId", formData.categoryId);
    payload.append("costCenter", formData.costCenter.trim());
    payload.append("location", formData.location.trim());
    payload.append("conditionGrade", formData.condition);
    if (formData.notes.trim()) {
      payload.append("conditionNotes", formData.notes.trim());
    }
    payload.append(
      "originalPurchasePrice",
      String(parseMoney(formData.purchasePrice))
    );
    payload.append("startingBid", String(parseMoney(formData.startingBid)));
    payload.append("startTime", new Date(formData.startTime).toISOString());
    payload.append("endTime", new Date(formData.endTime).toISOString());
    if (image) {
      payload.append("image", image);
    }

    setIsSubmitting(true);
    try {
      await createTender(payload);
      navigate("/pending-approvals");
    } catch (err) {
      setSubmitError(err.message || "Failed to publish tender.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ctp-page">
      <main className="ctp-main">
        <header className="ctp-heading">
          <h1>Create New Tender Listing</h1>
          <p>
            Provision new physical assets and configure active bidding rules
            for internal or external lots.
          </p>
        </header>

        {lookupsError && <p className="ctp-banner-error">{lookupsError}</p>}
        {submitError && <p className="ctp-banner-error">{submitError}</p>}

        <form className="ctp-card" onSubmit={handleSubmit} noValidate>
          <section className="ctp-section">
            <h2>1. Asset Core Metadata</h2>

            <div className="ctp-grid">
              <Field label="Asset Name" error={errors.assetName}>
                <input
                  type="text"
                  placeholder="e.g. Dell Latitude 5420 Laptop"
                  value={formData.assetName}
                  onChange={handleChange("assetName")}
                />
              </Field>

              <Field
                label="Barcode / Serial Number"
                hint="Optional — leave blank if the asset has none"
                error={errors.barcode}
              >
                <input
                  type="text"
                  placeholder="Unique NMU ID (optional)"
                  value={formData.barcode}
                  onChange={handleChange("barcode")}
                />
              </Field>

              <Field label="Department of Origin" error={errors.departmentId}>
                <select
                  value={formData.departmentId}
                  onChange={handleChange("departmentId")}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.departmentId} value={dept.departmentId}>
                      {dept.departmentName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cost Center Code" error={errors.costCenter}>
                <input
                  type="text"
                  placeholder="e.g. CC-1024"
                  value={formData.costCenter}
                  onChange={handleChange("costCenter")}
                />
              </Field>

              <Field label="Current Location" error={errors.location}>
                <input
                  type="text"
                  placeholder="Building, Room Number"
                  value={formData.location}
                  onChange={handleChange("location")}
                />
              </Field>
            </div>
          </section>

          <section className="ctp-section">
            <h2>2. Asset Inventory Details</h2>

            <div className="ctp-grid ctp-grid-with-image">
              <div className="ctp-grid-left">
                <Field label="Asset Category" error={errors.categoryId}>
                  <select
                    value={formData.categoryId}
                    onChange={handleChange("categoryId")}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.categoryName}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Condition Grade" error={errors.condition}>
                  <select
                    value={formData.condition}
                    onChange={handleChange("condition")}
                  >
                    <option value="">Select Condition</option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Condition Notes">
                  <textarea
                    rows={3}
                    placeholder="Describe specific wear, damage, or missing parts..."
                    value={formData.notes}
                    onChange={handleChange("notes")}
                  />
                </Field>
              </div>

              <div className="ctp-grid-right">
                <span className="ctp-label">Asset Image</span>
                <label
                  className={`ctp-dropzone${isDragging ? " ctp-dropzone-active" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    hidden
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                  {image ? (
                    <img
                      className="ctp-preview"
                      src={URL.createObjectURL(image)}
                      alt="Selected asset"
                    />
                  ) : (
                    <>
                      <span className="ctp-upload-icon" aria-hidden="true">
                        &#8593;
                      </span>
                      <span className="ctp-dropzone-text">
                        Drag and drop images here
                        <br />
                        or click to browse
                      </span>
                      <span className="ctp-dropzone-hint">
                        PNG, JPG up to 5MB
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </section>

          <section className="ctp-section">
            <h2>3. Financial &amp; Tender Settings</h2>

            <div className="ctp-grid">
              <Field
                label="Original Purchase Price"
                hint="Enter manually from ERP. Recommended sale price is 5% of this amount."
                error={errors.purchasePrice}
              >
                <div className="ctp-currency-input">
                  <span>R</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="00,000.00"
                    value={formData.purchasePrice}
                    onChange={handleChange("purchasePrice")}
                  />
                </div>
              </Field>

              <Field
                label="Starting Bid"
                hint="Prefilled at 5% of purchase price; you can edit it"
                error={errors.startingBid}
              >
                <div className="ctp-currency-input">
                  <span>R</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="00,000.00"
                    value={formData.startingBid}
                    onChange={handleChange("startingBid")}
                  />
                </div>
              </Field>

              <Field label="Tender Start Time" error={errors.startTime}>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleChange("startTime")}
                />
              </Field>

              <Field label="Tender End Time" error={errors.endTime}>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={handleChange("endTime")}
                />
              </Field>
            </div>
          </section>

          <div className="ctp-actions">
            <div className="ctp-actions-left">
              {isAddingCategory ? (
                <div className="ctp-add-category-panel">
                  <input
                    type="text"
                    className="ctp-add-category-input"
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      if (categoryError) setCategoryError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmAddCategory();
                      }
                      if (e.key === "Escape") closeAddCategory();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="ctp-add-category-confirm"
                    onClick={confirmAddCategory}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="ctp-add-category-cancel"
                    onClick={closeAddCategory}
                  >
                    Cancel
                  </button>
                  {categoryError && (
                    <span className="ctp-error">{categoryError}</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="ctp-add-category"
                  onClick={openAddCategory}
                >
                  + Add Category
                </button>
              )}
            </div>

            <div className="ctp-actions-right">
              <Link to="/admin" className="ctp-cancel">
                Cancel
              </Link>
              <button
                type="submit"
                className="ctp-publish"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit for Approval"}{" "}
                <span aria-hidden="true">&#8594;</span>
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <label className="ctp-field">
      <span className="ctp-label">{label}</span>
      {children}
      {hint && !error && <span className="ctp-hint">{hint}</span>}
      {error && <span className="ctp-error">{error}</span>}
    </label>
  );
}

export default CreateTenderPage;
