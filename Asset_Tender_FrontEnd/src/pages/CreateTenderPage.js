import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/CreateTenderPage.css";

const DEPARTMENTS = [
  "Faculty of Science",
  "Faculty of Engineering",
  "Faculty of Business and Economic Sciences",
  "Faculty of Health Sciences",
  "Facilities and Estates",
  "Information and Communication Technology",
];

const CATEGORIES = [
  "IT Equipment",
  "Furniture",
  "Vehicles",
  "Laboratory Equipment",
  "Machinery and Tools",
  "Office Equipment",
];

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "For Parts Only"];

function CreateTenderPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    department: "",
    costCenter: "",
    location: "",
    category: "",
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

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
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
    if (!formData.barcode.trim()) next.barcode = "Barcode / Serial number is required.";
    if (!formData.department) next.department = "Select a department.";
    if (!formData.category) next.category = "Select an asset category.";
    if (!formData.condition) next.condition = "Select a condition grade.";
    if (!formData.startingBid) next.startingBid = "Enter a starting bid.";
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    console.log("Publishing tender", { ...formData, image });
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

        <form className="ctp-card" onSubmit={handleSubmit} noValidate>
          <section className="ctp-section">
            <h2>1. Asset Core Metadata</h2>

            <div className="ctp-grid">
              <Field
                label="Barcode / Serial Number"
                error={errors.barcode}
              >
                <input
                  type="text"
                  placeholder="Unique NMU ID"
                  value={formData.barcode}
                  onChange={handleChange("barcode")}
                />
              </Field>

              <Field label="Department of Origin" error={errors.department}>
                <select
                  value={formData.department}
                  onChange={handleChange("department")}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cost Center Code">
                <input
                  type="text"
                  placeholder="e.g. CC-1024"
                  value={formData.costCenter}
                  onChange={handleChange("costCenter")}
                />
              </Field>

              <Field label="Current Location">
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
                <Field label="Asset Category" error={errors.category}>
                  <select
                    value={formData.category}
                    onChange={handleChange("category")}
                  >
                    <option value="">Select Category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
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
              <Field label="Original Purchase Price">
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
                hint="Minimum required opening bid"
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
            <Link to="/admin" className="ctp-cancel">
              Cancel
            </Link>
            <button type="submit" className="ctp-publish">
              Publish Tender <span aria-hidden="true">&#8594;</span>
            </button>
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