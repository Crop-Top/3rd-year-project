import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "../../styles/admin_style/EditTenderPage.css";
import { apiFetch, API_BASE_URL } from "../../services/apiClient";
import Portalfooter from "../../components/Portalfooter";
import Portalheader from "../../components/Portalheader";

const STATUSES = ["Active", "Closing Soon", "Closed"];

function EditTenderPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const targetId = id || location.state?.tender?.listingId || location.state?.asset?.assetId;

  const [categories, setCategories] = useState([]);
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

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setErrorMsg("");

      try {
        try {
          const catRes = await apiFetch(`${API_BASE_URL}/Lookups/Categories`);
          const catData = typeof catRes?.json === "function" ? await catRes.json() : catRes;
          if (isMounted && Array.isArray(catData)) {
            setCategories(catData);
          }
        } catch (catErr) {
          console.warn("Failed to load categories:", catErr);
        }

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
  }, [imageFile]);

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
      let finalImageUrl = imagePreview;

      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", imageFile);
        const uploadRes = await apiFetch(`${API_BASE_URL}/api/Assets/upload`, {
          method: 'POST',
          body: uploadForm
        });
        if (uploadRes?.url) {
          finalImageUrl = uploadRes.url;
        }
      }

      const payload = {
        title: form.title,
        barcodeSerial: form.barcodeSerial,
        categoryId: parseInt(form.categoryId, 10) || 0,
        departmentName: form.departmentName,
        costCenter: form.costCenter,
        location: form.location,
        description: form.description,
        assetConditionId: parseInt(form.assetConditionId, 10) || 1,
        conditionNotes: form.conditionNotes,
        recommendedPrice: parseFloat(form.recommendedPrice) || 0,
        startingBid: parseFloat(form.startingBid || form.leadingBid) || 0,
        imageUrl: finalImageUrl
      };

      const updateId = form.listingId || form.assetId || targetId;
      const token = localStorage.getItem("token");

      await apiFetch(`${API_BASE_URL}/admin/tenders/${updateId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setSaved(true);
      setInitialForm(form);
      setInitialImagePreview(finalImageUrl);
      setImageFile(null);
    } catch (err) {
      console.error("Failed to update tender/asset", err);
      setErrorMsg("Failed to save updates. Please try again.");
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
              <label className="etp-label" htmlFor="barcodeSerial">Barcode / Serial No.</label>
              <input
                id="barcodeSerial"
                type="text"
                className="etp-input"
                value={form.barcodeSerial}
                onChange={handleChange("barcodeSerial")}
              />
            </div>
            <div className="etp-field">
              <label className="etp-label" htmlFor="departmentName">Department Name</label>
              <input
                id="departmentName"
                type="text"
                className="etp-input"
                value={form.departmentName}
                onChange={handleChange("departmentName")}
              />
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

          <div className="etp-row">
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
            <div className="etp-field">
              <label className="etp-label" htmlFor="status">Status</label>
              <select id="status" className="etp-input" value={form.status} onChange={handleChange("status")}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

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
              <label className="etp-label" htmlFor="startingBid">Starting Bid / Reserve (ZAR)</label>
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

      <Portalfooter />
    </div>
  );
}

export default EditTenderPage;