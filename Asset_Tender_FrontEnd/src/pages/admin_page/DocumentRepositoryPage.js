import { useEffect, useState } from "react";
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import { getCurrentUser } from "../../services/authService";
import {
  deleteDocument,
  downloadDocument,
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

function DocumentRepositoryPage() {
  const currentUser = getCurrentUser() || {};
  const role = (currentUser.role || "").toLowerCase();
  const isSuperAdmin = role === "superadmin";

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [documentName, setDocumentName] = useState("");
  const [category, setCategory] = useState("General");
  const [file, setFile] = useState(null);
  const [visibleToInternal, setVisibleToInternal] = useState(true);
  const [visibleToExternal, setVisibleToExternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await listDocuments();
      setDocuments(rows);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setError("");

    if (!file) {
      setError("Choose a file to upload.");
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
        category: category.trim() || "General",
        visibleToInternal,
        visibleToExternal,
      });
      setDocumentName("");
      setCategory("General");
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

  const handleDownload = async (doc) => {
    setBusyId(doc.documentId);
    setError("");
    try {
      await downloadDocument(doc.documentId, doc.documentName);
    } catch (err) {
      setError(err.message || "Download failed.");
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
                <input
                  type="text"
                  placeholder="General"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                />
              </label>

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
                      <td>{doc.category}</td>
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
                            disabled={busyId === doc.documentId}
                            onClick={() => handleDownload(doc)}
                          >
                            Download
                          </button>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              className="doc-repo-btn-danger"
                              disabled={busyId === doc.documentId}
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

      <PortalFooter />
    </div>
  );
}

export default DocumentRepositoryPage;
