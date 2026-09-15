import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "../../styles/admin_style/EditTenderPage.css";
import { apiFetch, API_BASE_URL } from "../../services/apiClient";
import Portalfooter from "../../components/Portalfooter";
import Portalheader from "../../components/Portalheader";

function EditTenderPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const targetId = id || location.state?.tender?.listingId || location.state?.asset?.assetId;

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [initialForm, setInitialForm] = useState(null);
  const [form, setForm] = useState({
    listingId: targetId || "",
    assetId: "",
    title: "",
    barcodeSerial: "",
    categoryId: "",
    categoryName: "",
    departmentId: "",
    departmentName: "",
    costCenter: "",
    location: "",
    description: "",
    assetConditionId: "",
    conditionName: "",
    conditionNotes: "",
    recommendedPrice: "",
    startingBid: "",
    leadingBid: "",
    status: "Active",
    uploadedBy: "",
    approvedBy: "",
    rejectedBy: "",
    rejectionReason: ""
  });

  const [initialImagePreview, setInitialImagePreview] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Modal and Redirect Timer State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Check if current category is a Vehicle category
  const isVehicleCategory = React.useMemo(() => {
    if (!form.categoryName) return false;
    return form.categoryName.trim().toLowerCase().includes("vehicle");
  }, [form.categoryName]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      try {
        // Fetch Categories
        try {
          const catRes = await apiFetch(`${API_BASE_URL}/Lookups/Categories`);
          const catData = typeof catRes?.json === "function" ? await catRes.json() : catRes;
          if (isMounted && Array.isArray(catData)) {
            setCategories(catData);
          }
        } catch (catErr) {
          console.warn("Failed to load categories:", catErr);
        }

        // Fetch Departments
        try {
          const deptRes = await apiFetch(`${API_BASE_URL}/Lookups/Departments`);
          const deptData = typeof deptRes?.json === "function" ? await deptRes.json() : deptRes;
          if (isMounted && Array.isArray(deptData)) {
            setDepartments(deptData);
          }
        } catch (deptErr) {
          console.warn("Failed to load departments:", deptErr);
        }

        // Fetch Tender Details
        if (targetId) {
          const response = await apiFetch(`${API_BASE_URL}/admin/tenders/${targetId}/edit-details`);
          const detailData = typeof response?.json === "function" ? await response.json() : response;

          if (isMounted && detailData) {
            const loadedForm = {
              listingId: detailData.listingId ?? "",
              assetId: detailData.assetId ?? "",
              title: detailData.title ?? "",
              barcodeSerial: detailData.barcodeSerial ?? "",
              categoryId: detailData.categoryId ?? "",
              categoryName: detailData.categoryName ?? "",
              departmentId: detailData.departmentId ?? "",
              departmentName: detailData.departmentName ?? "",
              costCenter: detailData.costCenter ?? "",
              location: detailData.location ?? "",
              description: detailData.description ?? "",
              assetConditionId: detailData.assetConditionId ?? "1",
              conditionName: detailData.conditionName ?? "",
              conditionNotes: detailData.conditionNotes ?? "",
              recommendedPrice: detailData.recommendedPrice ?? "",
              startingBid: detailData.startingBid ?? "",
              leadingBid: detailData.leadingBid ?? "",
              status: detailData.status || "Active",
              uploadedBy: detailData.uploadedBy ?? "",
              approvedBy: detailData.approvedBy ?? "",
              rejectedBy: detailData.rejectedBy ?? "",
              rejectionReason: detailData.rejectionReason ?? ""
            };

            setForm(loadedForm);
            setInitialForm(loadedForm);

            if (detailData.imageUrl) {
              const fullImageUrl = detailData.imageUrl.startsWith("http")
                ? detailData.imageUrl
                : `${API_BASE_URL}${detailData.imageUrl.startsWith('/') ? '' : '/'}${detailData.imageUrl}`;

              setImagePreview(fullImageUrl);
              setInitialImagePreview(fullImageUrl);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load tender details:", err);
        if (isMounted) setErrorMsg("Failed to retrieve asset details from server.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => { isMounted = false; };
  }, [targetId]);

  useEffect(() => {
    return () => {
      if (imageFile && imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imageFile, imagePreview]);

  // Handle countdown timer & redirection to /admin
  useEffect(() => {
    if (!showSuccessModal) return;

    if (countdown <= 0) {
      navigate("/admin");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showSuccessModal, countdown, navigate]);

  const isDirty = React.useMemo(() => {
    if (!initialForm) return false;

    if (imageFile !== null || imagePreview !== initialImagePreview) {
      return true;
    }

    return Object.keys(initialForm).some(
      (key) => String(form[key] ?? "") !== String(initialForm[key] ?? "")
    );
  }, [form, initialForm, imageFile, imagePreview, initialImagePreview]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const handleCategoryChange = (e) => {
    const selectedName = e.target.value;
    const selectedObj = categories.find((c) => c.categoryName === selectedName);

    setForm((prev) => ({
      ...prev,
      categoryName: selectedName,
      categoryId: selectedObj ? selectedObj.categoryId : prev.categoryId
    }));
    setSaved(false);
  };

  const handleDepartmentInputChange = (e) => {
    const selectedText = e.target.value ?? "";

    const match = departments.find(
      (d) => (d.name ?? d.departmentName ?? "").toLowerCase() === selectedText.toLowerCase()
    );

    const valueToStoreId = match ? (match.id ?? match.departmentCode ?? match.departmentId) : form.departmentId;

    setForm((prev) => ({
      ...prev,
      departmentName: selectedText,
      departmentId: valueToStoreId
    }));
    setSaved(false);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imageFile && imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSaved(false);
  };

  const handleRemoveImage = () => {
    if (imageFile && imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSaved(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isDirty || saving) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const updateId = form.listingId || form.assetId || targetId;
      const payload = new FormData();
      payload.append("title", form.title ?? "");
      payload.append("barcodeSerial", form.barcodeSerial ?? "");
      payload.append("categoryId", String(parseInt(form.categoryId, 10) || 0));
      payload.append("departmentId", String(form.departmentId ?? ""));
      payload.append("departmentName", form.departmentName ?? "");
      payload.append("costCenter", form.costCenter ?? "");
      payload.append("location", form.location ?? "");
      payload.append("description", form.description ?? "");
      payload.append("assetConditionId", String(parseInt(form.assetConditionId, 10) || 1));
      payload.append("conditionNotes", form.conditionNotes ?? "");
      payload.append(
        "recommendedPrice",
        String(isVehicleCategory ? (parseFloat(form.recommendedPrice) || 0) : 0)
      );
      payload.append(
        "startingBid",
        String(isVehicleCategory ? (parseFloat(form.startingBid || form.leadingBid) || 0) : 0)
      );

      if (imageFile) {
        payload.append("image", imageFile);
      }

      const response = await apiFetch(`${API_BASE_URL}/admin/tenders/${updateId}`, {
        method: "PUT",
        body: payload,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.Message || "Failed to save updates.");
      }

      // Show success modal & start 5-second countdown to /admin
      setSaved(true);
      setCountdown(5);
      setShowSuccessModal(true);

    } catch (err) {
      console.error("Failed to update tender/asset", err);
      setErrorMsg(err.message || "Failed to save updates. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="etp-page">
        <Portalheader />
        <div className="etp-content" style={{ padding: "40px", textAlign: "center" }}>
          Loading asset and tender details...
        </div>
        <Portalfooter />
      </div>
    );
  }

  // Determine current display value for department input
  const currentDepartmentDisplay =
    departments.find(
      (d) =>
        (d.id ?? d.departmentCode ?? d.departmentId) === form.departmentId ||
        (d.name ?? d.departmentName ?? "").toLowerCase() === (form.departmentName ?? "").toLowerCase()
    )?.name ??
    departments.find(
      (d) =>
        (d.name ?? d.departmentName ?? "").toLowerCase() === (form.departmentName ?? "").toLowerCase()
    )?.departmentName ??
    form.departmentName ??
    "";

  return (
    <div className="etp-page">
      <Portalheader />

      <div className="etp-content">
        <div className="etp-header-row">
          <div>
            <span className="etp-eyebrow">ASSET / TENDER #{form.listingId || form.assetId || "—"}</span>
            <h1 className="etp-title">Edit Asset Inventory Details</h1>
          </div>
        </div>

        {saved && <div className="etp-success-banner">✓ Record updated successfully.</div>}
        {errorMsg && <div className="etp-error-banner" style={{ color: '#d9534f', marginBottom: '15px' }}>{errorMsg}</div>}

        <form className="etp-form-card" onSubmit={handleSave}>
          <div className="etp-field">
            <label className="etp-label" htmlFor="title">Asset Name / Title</label>
            <input
              id="title"
              type="text"
              className="etp-input"
              value={form.title}
              onChange={handleChange("title")}
              required
            />
          </div>

          <div className="etp-row">
            <div className="etp-field">
              <label className="etp-label" htmlFor="barcodeSerial">
                {isVehicleCategory ? "Registration / VIN" : "Barcode / Serial No."}
              </label>
              <input
                id="barcodeSerial"
                type="text"
                className="etp-input"
                value={form.barcodeSerial}
                onChange={handleChange("barcodeSerial")}
              />
            </div>
            <div className="etp-field">
              <label className="etp-label" htmlFor="departmentName">Department of Origin</label>
              <input
                id="departmentName"
                type="text"
                list="department-options"
                placeholder="Type or select a department..."
                className="etp-input"
                value={currentDepartmentDisplay}
                onChange={handleDepartmentInputChange}
              />
              <datalist id="department-options">
                {departments.map((dept) => {
                  const code = dept.id ?? dept.departmentCode ?? dept.departmentId ?? "";
                  const name = dept.name ?? dept.departmentName ?? "";
                  const faculty = dept.facultyName ?? "";

                  return (
                    <option key={code || name} value={name}>
                      {faculty ? `${name} (${faculty})` : name}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          <div className="etp-row">
            <div className="etp-field">
              <label className="etp-label" htmlFor="costCenter">Cost Center</label>
              <input
                id="costCenter"
                type="text"
                className="etp-input"
                value={form.costCenter}
                onChange={handleChange("costCenter")}
              />
            </div>
            <div className="etp-field">
              <label className="etp-label" htmlFor="location">Location</label>
              <input
                id="location"
                type="text"
                className="etp-input"
                value={form.location}
                onChange={handleChange("location")}
              />
            </div>
          </div>

          <div className="etp-field">
            <label className="etp-label" htmlFor="category">Category</label>
            <select
              id="category"
              className="etp-input"
              value={form.categoryName}
              onChange={handleCategoryChange}
            >
              {categories.map((c) => (
                <option key={c.categoryId || c.categoryName} value={c.categoryName}>
                  {c.categoryName}
                </option>
              ))}
            </select>
          </div>

          {/* Render price and valuation inputs ONLY for vehicle category */}
          {isVehicleCategory && (
            <div className="etp-row">
              <div className="etp-field">
                <label className="etp-label" htmlFor="recommendedPrice">Recommended Price (ZAR)</label>
                <input
                  id="recommendedPrice"
                  type="number"
                  step="0.01"
                  className="etp-input"
                  value={form.recommendedPrice}
                  onChange={handleChange("recommendedPrice")}
                />
              </div>
              <div className="etp-field">
                <label className="etp-label" htmlFor="startingBid">Reserve Price (ZAR)</label>
                <input
                  id="startingBid"
                  type="number"
                  step="0.01"
                  className="etp-input"
                  value={form.startingBid || form.leadingBid}
                  onChange={handleChange("startingBid")}
                />
              </div>
            </div>
          )}

          <div className="etp-field">
            <label className="etp-label" htmlFor="description">Asset Description</label>
            <textarea
              id="description"
              className="etp-textarea"
              rows={3}
              value={form.description}
              onChange={handleChange("description")}
            />
          </div>

          <div className="etp-field">
            <label className="etp-label" htmlFor="conditionNotes">Condition Notes</label>
            <textarea
              id="conditionNotes"
              className="etp-textarea"
              rows={3}
              value={form.conditionNotes}
              onChange={handleChange("conditionNotes")}
            />
          </div>

          <div className="etp-field">
            <label className="etp-label" htmlFor="imageUpload">Asset Image</label>
            {imagePreview ? (
              <div className="etp-image-preview-wrapper">
                <img src={imagePreview} alt="Asset preview" className="etp-image-preview" />
                <button type="button" className="etp-image-remove-btn" onClick={handleRemoveImage}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="etp-image-empty">No image uploaded</div>
            )}

            <input
              id="imageUpload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="etp-file-input"
              onChange={handleImageFileChange}
            />
          </div>

          {(form.uploadedBy || form.approvedBy || form.rejectedBy) && (
            <div className="etp-audit-section" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Audit & Approval Details</h4>
              <div className="etp-row">
                {form.uploadedBy && <div><strong>Uploaded By:</strong> {form.uploadedBy}</div>}
                {form.approvedBy && <div><strong>Approved By:</strong> {form.approvedBy}</div>}
                {form.rejectedBy && <div><strong>Rejected By:</strong> {form.rejectedBy}</div>}
              </div>
              {form.rejectionReason && (
                <div style={{ marginTop: '8px', color: '#c00' }}>
                  <strong>Rejection Reason:</strong> {form.rejectionReason}
                </div>
              )}
            </div>
          )}

          <div className="etp-form-actions">
            <button type="button" className="etp-btn etp-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="etp-btn etp-btn-primary" 
              disabled={!isDirty || saving}
              style={{
                opacity: (!isDirty || saving) ? 0.5 : 1,
                cursor: (!isDirty || saving) ? "not-allowed" : "pointer"
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Success Popup Modal */}
      {showSuccessModal && (
        <div 
          className="etp-modal-overlay" 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div 
            className="etp-modal-card" 
            style={{
              background: "#ffffff",
              padding: "30px",
              borderRadius: "8px",
              textAlign: "center",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
            }}
          >
            <div style={{ fontSize: "48px", color: "#28a745", marginBottom: "10px" }}>✓</div>
            <h2 style={{ margin: "0 0 10px 0", fontSize: "20px", color: "#333" }}>Tender Updated Successfully</h2>
            <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>
              Your changes have been saved.
            </p>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#888" }}>
              Redirecting to admin dashboard in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
            </p>
            <button
              type="button"
              className="etp-btn etp-btn-primary"
              onClick={() => navigate("/admin")}
              style={{ width: "100%" }}
            >
              Go to Admin Now
            </button>
          </div>
        </div>
      )}

      <Portalfooter />
    </div>
  );
}

export default EditTenderPage;