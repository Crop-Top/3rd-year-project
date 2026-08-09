import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import "../../styles/admin_style/EditTenderPage.css";


const CATEGORIES = [
  "VEHICLES - SEDANS",
  "VEHICLES - UTILITY",
  "SCIENTIFIC",
  "IT INFRASTRUCTURE",
  "FURNITURE",
  "OFFICE EQUIPMENT",
];

const STATUSES = ["Active", "Closing Soon", "Closed"];

function EditTenderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // AdminPage navigates here with `state: { tender }` — this is the same
  // blueprint pattern used by AssetDetailPage: read the incoming record and
  // fill the form from it rather than hardcoding a single tender.
  const incomingTender = location.state?.tender || {};

  const [form, setForm] = useState({
    title: incomingTender.title || "",
    category: incomingTender.category || CATEGORIES[0],
    description: incomingTender.description || "",
    leadingBid: incomingTender.leadingBid || "",
    status: incomingTender.status || "Active",
  });

  // Images are picked from disk rather than typed as a URL. imageFile holds
  // the actual File object to upload on save; imagePreview is either that
  // file's local object-URL, or the tender's existing image if one was
  // already set (e.g. editing a tender that already has a photo).
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(incomingTender.image || "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Revoke the local object-URL when it's replaced or the component
  // unmounts, so the browser doesn't hold onto the file indefinitely.
  useEffect(() => {
    return () => {
      if (imageFile && imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
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

  const handleSave = async () => {
    setSaving(true);
    // TODO: replace with a real save call once the backend endpoint exists.
    // If a new local file was picked, upload it first (e.g. multipart POST
    // to the assets upload endpoint your backend already serves images
    // from — visible in the existing tender's image URLs), then send the
    // returned URL along with the rest of the form:
    //
    //   let imageUrl = incomingTender.image;
    //   if (imageFile) {
    //     const uploadForm = new FormData();
    //     uploadForm.append("file", imageFile);
    //     const uploadRes = await fetch(`${API_BASE}/Assets/upload`, { method: "POST", body: uploadForm });
    //     const { url } = await uploadRes.json();
    //     imageUrl = url;
    //   }
    //   await updateTender(incomingTender.listingId, { ...form, image: imageUrl });
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
    setSaved(true);
  };

  return (
    <AdminLayout pageLabel="Edit Tender">
      <div className="etp-header-row">
        <div>
          <span className="etp-eyebrow">TENDER #{incomingTender.listingId || "—"}</span>
          <h1 className="etp-title">Edit Tender</h1>
        </div>
        <div className="etp-header-actions">
          <button type="button" className="etp-btn etp-btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="button" className="etp-btn etp-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saved && <div className="etp-success-banner">✓ Tender updated successfully.</div>}

      <div className="etp-form-card">
        <div className="etp-field">
          <label className="etp-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            className="etp-input"
            value={form.title}
            onChange={handleChange("title")}
          />
        </div>

        <div className="etp-row">
          <div className="etp-field">
            <label className="etp-label" htmlFor="category">
              Category
            </label>
            <select id="category" className="etp-input" value={form.category} onChange={handleChange("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="etp-field">
            <label className="etp-label" htmlFor="status">
              Status
            </label>
            <select id="status" className="etp-input" value={form.status} onChange={handleChange("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="etp-field">
          <label className="etp-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="etp-textarea"
            rows={4}
            value={form.description}
            onChange={handleChange("description")}
          />
        </div>

        <div className="etp-field">
          <label className="etp-label" htmlFor="leadingBid">
            Leading Bid (ZAR)
          </label>
          <input
            id="leadingBid"
            type="number"
            className="etp-input"
            value={form.leadingBid}
            onChange={handleChange("leadingBid")}
          />
        </div>

        <div className="etp-field">
          <label className="etp-label" htmlFor="imageUpload">
            Tender Image
          </label>

          {imagePreview ? (
            <div className="etp-image-preview-wrapper">
              <img src={imagePreview} alt="Tender preview" className="etp-image-preview" />
              <button type="button" className="etp-image-remove-btn" onClick={handleRemoveImage}>
                Remove
              </button>
            </div>
          ) : (
            <div className="etp-image-empty">No image selected</div>
          )}

          <input
            id="imageUpload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="etp-file-input"
            onChange={handleImageFileChange}
          />
          <span className="etp-image-hint">JPG or PNG, uploaded from your computer.</span>
        </div>
      </div>
    </AdminLayout>
  );
}

export default EditTenderPage;