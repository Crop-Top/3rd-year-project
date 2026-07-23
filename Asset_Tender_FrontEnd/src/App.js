import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import LandingPage from "./pages/public_page/LandingPage";
import BrowseAssetsPage from "./pages/staff_page/BrowseAssetsPage";
import RegistrationPage from "./pages/public_page/RegistrationPage";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/admin_page/AdminPage";
import CreateTenderPage from "./pages/admin_page/CreateTenderPage";
import Pendingapprovals from "./pages/admin_page/Pendingapprovals";
import AssetDetailPage from "./pages/staff_page/AssetDetailPage";
import UserManagementPage from "./pages/admin_page/UserManagementPage";
import EditUserDetails from "./pages/admin_page/EditUserDetails";
import RegistrationRequest from "./pages/admin_page/RegistrationRequest";
import TenderDetailPage from "./pages/admin_page/TenderDetailPage";
import AuditReportsDashboard from "./pages/admin_page/AuditReportsDashboard";
import AuditReportPreview from "./pages/admin_page/AuditReportPreview";
import { serviceTriggerSilentRefresh, getCurrentUser } from "./services/authService";

// 👇 Links shown to everyone (Staff and Admin both land here)
const staffLinks = [{ to: "/browse", label: "🔍 Browse Tenders" }];

// 👇 Extra links only shown once the logged-in user is an Admin
const adminLinks = [
  { to: "/browse", label: "🔍 Browse Tenders" },
  { to: "/admin", label: "🗂️ Manage Tenders" },
  { to: "/create-tender", label: "➕ Create New Tender" },
  { to: "/pending-approvals", label: "📋 Pending Approvals" },
  { to: "/registration-request", label: "📋 Registration Request" },
  { to: "/edit-user-details", label: "👤 Edit User Details" },
  { to: "/tender-detail", label: "🚗 Tender Detail" },
  { to: "/audit-reports", label: "📊 Audit Reports" },
  { to: "/audit-report-preview", label: "📄 Report Preview" },
];

// This inner component lives INSIDE the router. useLocation() re-renders it
// on every navigation (including the redirect that happens right after
// login/logout), which is what forces a fresh getCurrentUser() check and
// keeps the sidebar in sync with whoever is actually logged in.
function AppRoutes() {
  const location = useLocation();

  const currentUser = getCurrentUser();
  const userRole = currentUser?.role || "Staff";
  const sidebarLinks = userRole === "Admin" ? adminLinks : staffLinks;

  const isPublicPage = location.pathname === "/" || location.pathname === "/register";

  return (
    <>
      {!isPublicPage && <Sidebar links={sidebarLinks} />}

      <Routes>
        {/* ==================== 1. PUBLIC ROUTES ==================== */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        {/* ==================== 2. STAFF ACCESS BRANCH ==================== */}
        <Route element={<ProtectedRoute allowedRoles={["Staff"]} />}>
          <Route path="/browse" element={<BrowseAssetsPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
        </Route>

        {/* ==================== 3. ADMIN ACCESS BRANCH ==================== */}
        <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/create-tender" element={<CreateTenderPage />} />
          <Route path="/pending-approvals" element={<Pendingapprovals />} />
          <Route path="/registration-request" element={<RegistrationRequest />} />
          <Route path="/edit-user-details" element={<EditUserDetails/>} />
          <Route path="/user-management" element={<UserManagementPage />} />
          <Route path="/tender-detail" element={<TenderDetailPage />} />
          <Route path="/audit-reports" element={<AuditReportsDashboard />} />
          <Route path="/audit-report-preview" element={<AuditReportPreview />} />
        </Route>

        <Route path="*" element={<LandingPage />} />

      </Routes>
    </>
  );
}

function App() {
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log("App mounted. Checking backend for active refresh cookie session...");
        await serviceTriggerSilentRefresh();
      } catch (err) {
        console.warn("No active session cookie found on app initialization:", err);
      } finally {
        setLoadingSession(false);
      }
    };

    initializeSession();
  }, []);

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#38bdf8', marginBottom: '10px' }}>Nelson Mandela University Portal</h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Restoring secure session state...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;