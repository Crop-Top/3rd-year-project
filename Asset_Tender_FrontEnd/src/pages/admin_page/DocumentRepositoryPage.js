import { useEffect, useState } from "react";
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import { getCurrentUser } from "../../services/authService";
import {
  createDocumentCategory,
  deleteDocument,
  downloadDocument,
  fetchDocumentForPreview,
  listDocumentCategories,
  listDocuments,
  uploadDocument,
} from "../../services/documentService";
import "../../styles/admin_style/DocumentRepositoryPage.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA");
}

function resolvePreviewKind(contentType, fileName) {
  const mime = (contentType || "").toLowerCase().split(";")[0].trim();
  const ext = (fileName || "").split(".").pop()?.toLowerCase() || "";
  // If name has no extension, "ext" is the whole name — ignore unless short
  const hasExt = (fileName || "").includes(".") && ext.length <= 5;

  if (mime.includes("pdf") || (hasExt && ext === "pdf")) return "pdf";
  if (
    mime.startsWith("image/") ||
    (hasExt && (ext === "png" || ext === "jpg" || ext === "jpeg"))
  ) {
    return "image";
  }
  return "unsupported";
}

function DocumentRepositoryPage() {
  const currentUser = getCurrentUser() || {};
  const role = (currentUser.role || "").toLowerCase();
  const isSuperAdmin = role === "superadmin";
  const canManageCategories = role === "admin" || role === "superadmin";

  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [documentName, setDocumentName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState(null);
  const [visibleToInternal, setVisibleToInternal] = useState(true);
  const [visibleToExternal, setVisibleToExternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [previewBusyId, setPreviewBusyId] = useState(null);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [preview, setPreview] = useState(null);

  const closePreview = () => {
    setPreview((prev) => {
      if (prev?.objectUrl) {
        window.URL.revokeObjectURL(prev.objectUrl);
      }
      return null;
    });
  };

  const loadCategories = async () => {
    const rows = await listDocumentCategories();
    setCategories(rows);
    setCategoryId((prev) => {
      if (prev && rows.some((c) => String(c.categoryId) === String(prev))) {
        return String(prev);
      }
      const general = rows.find(
        (c) => (c.categoryName || "").toLowerCase() === "general"
      );
      return String(general?.categoryId ?? rows[0]?.categoryId ?? "");
    });
    return rows;
  };

  const loadDocuments = async () => {
    const rows = await listDocuments();
    setDocuments(rows);
  };

  const loadPage = async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadCategories(), loadDocuments()]);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    return () => {
      if (preview?.objectUrl) {
        window.URL.revokeObjectURL(preview.objectUrl);
      }
    };
  }, [preview?.objectUrl]);

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

    setSavingCategory(true);
    setCategoryError("");
    try {
      const created = await createDocumentCategory(trimmed);
      setCategories((prev) =>
        [...prev, created].sort((a, b) =>
          a.categoryName.localeCompare(b.categoryName)
        )
      );
      setCategoryId(String(created.categoryId));
      setSuccessMessage(`Category "${created.categoryName}" created.`);
      closeAddCategory();
    } catch (err) {
      setCategoryError(err.message || "Failed to create category.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setError("");

    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!categoryId) {
      setError("Select a document category.");
      return;
    }
    if (!visibleToInternal && !visibleToExternal) {
      setError("Select at least one audience: Internal or External.");
      return;
    }

    setUploading(true);
    try {
      await uploadDocument({
        file,
        documentName: documentName.trim() || undefined,
        documentCategoryId: Number(categoryId),
        visibleToInternal,
        visibleToExternal,
      });
      setDocumentName("");
      setFile(null);
      setVisibleToInternal(true);
      setVisibleToExternal(false);
      e.target.reset?.();
      setSuccessMessage("Document uploaded successfully.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc) => {
    setPreviewBusyId(doc.documentId);
    setError("");
    try {
      const { blob, contentType, fileName } = await fetchDocumentForPreview(
        doc.documentId,
        doc.documentName
      );
      const kind = resolvePreviewKind(contentType, fileName || doc.documentName);
      const objectUrl =
        kind === "pdf" || kind === "image" ? window.URL.createObjectURL(blob) : null;

      setPreview((prev) => {
        if (prev?.objectUrl) {
          window.URL.revokeObjectURL(prev.objectUrl);
        }
        return {
          documentId: doc.documentId,
          documentName: fileName || doc.documentName,
          kind,
          objectUrl,
        };
      });
    } catch (err) {
      const msg = err.message || "Failed to open preview.";
      setError(msg);
    } finally {
      setPreviewBusyId(null);
    }
  };

  const handleDownload = async (doc) => {
    setBusyId(doc.documentId);
    setError("");
    try {
      await downloadDocument(doc.documentId, doc.documentName);
    } catch (err) {
      const msg = err.message || "Download failed.";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.documentName}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(doc.documentId);
    setError("");
    setSuccessMessage("");
    try {
      await deleteDocument(doc.documentId);
      setSuccessMessage("Document deleted.");
      await loadDocuments();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="doc-repo-page">
      <PortalHeader />

      <main className="doc-repo-main">
        <header className="doc-repo-heading">
          <h1>Document Repository</h1>
          <p>
            Download official tender portal documents. Visibility is controlled by
            Super Admin.
          </p>
        </header>

        {error && <p className="doc-repo-banner doc-repo-banner-error">{error}</p>}
        {successMessage && (
          <p className="doc-repo-banner doc-repo-banner-success">{successMessage}</p>
        )}

        {canManageCategories && !isSuperAdmin && (
          <section className="doc-repo-card">
            <h2>Document categories</h2>
            {isAddingCategory ? (
              <div className="doc-repo-add-category-panel">
                <input
                  type="text"
                  className="doc-repo-add-category-input"
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
                  disabled={savingCategory}
                />
                <button
                  type="button"
                  className="doc-repo-btn-primary"
                  onClick={confirmAddCategory}
                  disabled={savingCategory}
                >
                  {savingCategory ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  className="doc-repo-btn-secondary"
                  onClick={closeAddCategory}
                  disabled={savingCategory}
                >
                  Cancel
                </button>
                {categoryError && <span className="doc-repo-inline-error">{categoryError}</span>}
              </div>
            ) : (
              <button type="button" className="doc-repo-btn-secondary" onClick={openAddCategory}>
                + Add Category
              </button>
            )}
          </section>
        )}

        {isSuperAdmin && (
          <section className="doc-repo-card">
            <h2>Upload document</h2>
            <form className="doc-repo-upload-form" onSubmit={handleUpload}>
              <label className="doc-repo-field">
                <span>Document title</span>
                <input
                  type="text"
                  placeholder="e.g. Bidding terms and conditions"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  disabled={uploading}
                />
              </label>

              <label className="doc-repo-field">
                <span>Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={uploading || categories.length === 0}
                  required
                >
                  {categories.length === 0 && <option value="">No categories yet</option>}
                  {categories.map((cat) => (
                    <option key={cat.categoryId} value={cat.categoryId}>
                      {cat.categoryName}
                    </option>
                  ))}
                </select>
              </label>

              {isAddingCategory ? (
                <div className="doc-repo-add-category-panel">
                  <input
                    type="text"
                    className="doc-repo-add-category-input"
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
                    disabled={savingCategory}
                  />
                  <button
                    type="button"
                    className="doc-repo-btn-primary"
                    onClick={confirmAddCategory}
                    disabled={savingCategory}
                  >
                    {savingCategory ? "Adding…" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="doc-repo-btn-secondary"
                    onClick={closeAddCategory}
                    disabled={savingCategory}
                  >
                    Cancel
                  </button>
                  {categoryError && <span className="doc-repo-inline-error">{categoryError}</span>}
                </div>
              ) : (
                <button
                  type="button"
                  className="doc-repo-btn-secondary"
                  onClick={openAddCategory}
                  disabled={uploading}
                >
                  + Add Category
                </button>
              )}

              <label className="doc-repo-field">
                <span>File (PDF, DOCX, XLSX, PNG, JPEG)</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={uploading}
                  required
                />
              </label>

              <div className="doc-repo-audience">
                <span className="doc-repo-audience-label">Available to</span>
                <label className="doc-repo-check">
                  <input
                    type="checkbox"
                    checked={visibleToInternal}
                    onChange={(e) => setVisibleToInternal(e.target.checked)}
                    disabled={uploading}
                  />
                  Internal (Staff / Admins)
                </label>
                <label className="doc-repo-check">
                  <input
                    type="checkbox"
                    checked={visibleToExternal}
                    onChange={(e) => setVisibleToExternal(e.target.checked)}
                    disabled={uploading}
                  />
                  External (Bidders)
                </label>
              </div>

              <button type="submit" className="doc-repo-btn-primary" disabled={uploading}>
                {uploading ? "Uploading…" : "Upload document"}
              </button>
            </form>
          </section>
        )}

        <section className="doc-repo-card">
          <h2>Available documents</h2>

          {loading && <p className="doc-repo-muted">Loading documents…</p>}

          {!loading && documents.length === 0 && (
            <p className="doc-repo-muted">No documents are available for your account.</p>
          )}

          {!loading && documents.length > 0 && (
            <div className="doc-repo-table-wrap">
              <table className="doc-repo-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Uploaded</th>
                    {isSuperAdmin && <th>Audience</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.documentId}>
                      <td>
                        <div className="doc-repo-name">{doc.documentName}</div>
                        {doc.uploadedByName && (
                          <div className="doc-repo-sub">By {doc.uploadedByName}</div>
                        )}
                      </td>
                      <td>{doc.categoryName}</td>
                      <td>{formatDate(doc.uploadDate)}</td>
                      {isSuperAdmin && (
                        <td>
                          <div className="doc-repo-badges">
                            {doc.visibleToInternal && (
                              <span className="doc-repo-badge">Internal</span>
                            )}
                            {doc.visibleToExternal && (
                              <span className="doc-repo-badge doc-repo-badge-ext">External</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="doc-repo-actions">
                          <button
                            type="button"
                            className="doc-repo-btn-secondary"
                            disabled={
                              busyId === doc.documentId ||
                              previewBusyId === doc.documentId
                            }
                            onClick={() => handleView(doc)}
                          >
                            {previewBusyId === doc.documentId ? "Loading…" : "View"}
                          </button>
                          <button
                            type="button"
                            className="doc-repo-btn-secondary"
                            disabled={
                              busyId === doc.documentId ||
                              previewBusyId === doc.documentId
                            }
                            onClick={() => handleDownload(doc)}
                          >
                            Download
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              className="doc-repo-btn-danger"
                              disabled={
                                busyId === doc.documentId ||
                                previewBusyId === doc.documentId
                              }
                              onClick={() => handleDelete(doc)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {preview && (
        <div
          className="doc-repo-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-repo-preview-title"
          onClick={closePreview}
        >
          <div
            className="doc-repo-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doc-repo-preview-header">
              <h2 id="doc-repo-preview-title">{preview.documentName}</h2>
              <div className="doc-repo-preview-header-actions">
                <button
                  type="button"
                  className="doc-repo-btn-secondary"
                  onClick={() =>
                    handleDownload({
                      documentId: preview.documentId,
                      documentName: preview.documentName,
                    })
                  }
                  disabled={busyId === preview.documentId}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="doc-repo-btn-secondary"
                  onClick={closePreview}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="doc-repo-preview-body">
              {preview.kind === "pdf" && preview.objectUrl && (
                <iframe
                  title={preview.documentName}
                  src={preview.objectUrl}
                  className="doc-repo-preview-frame"
                />
              )}
              {preview.kind === "image" && preview.objectUrl && (
                <img
                  src={preview.objectUrl}
                  alt={preview.documentName}
                  className="doc-repo-preview-image"
                />
              )}
              {preview.kind === "unsupported" && (
                <div className="doc-repo-preview-fallback">
                  <p>
                    In-browser preview is not available for this file type
                    (Word/Excel or similar). Use Download to open it on your device.
                  </p>
                  <button
                    type="button"
                    className="doc-repo-btn-primary"
                    onClick={() =>
                      handleDownload({
                        documentId: preview.documentId,
                        documentName: preview.documentName,
                      })
                    }
                    disabled={busyId === preview.documentId}
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}

export default DocumentRepositoryPage;
