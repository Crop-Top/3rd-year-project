import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import LandingPage from "./pages/public_page/LandingPage";
import BrowseAssetsPage from "./pages/staff_page/BrowseAssetsPage";
import RegistrationPage from "./pages/public_page/RegistrationPage";
import VerifyEmailPage from "./pages/public_page/VerifyEmailPage"; // 👈 1. Added Import
import ForgotPasswordPage from "./pages/public_page/ForgotPasswordPage";
import ResetPasswordPage from "./pages/public_page/ResetPasswordPage";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/admin_page/AdminPage";
import CreateTenderPage from "./pages/admin_page/CreateTenderPage";
import Pendingapprovals from "./pages/admin_page/Pendingapprovals";
import ExpiredTendersPage from "./pages/admin_page/ExpiredTendersPage";
import WinningBidsPage from "./pages/staff_page/WinningBidsPage";
import MyActiveBidsPage from "./pages/staff_page/MyActiveBidsPage";
import AssetDetailPage from "./pages/staff_page/AssetDetailPage";
import UserManagementPage from "./pages/admin_page/UserManagementPage";
import EditUserDetails from "./pages/admin_page/EditUserDetails";
import RegistrationRequest from "./pages/admin_page/RegistrationRequest";
import TenderDetailPage from "./pages/admin_page/TenderDetailPage";
import EditTenderPage from "./pages/admin_page/EditTenderPage";
import AuditReportsDashboard from "./pages/admin_page/AuditReportsDashboard";
import AuditReportPreview from "./pages/admin_page/AuditReportPreview";
import { serviceTriggerSilentRefresh, getCurrentUser } from "./services/authService";

// 👇 Links shown to everyone (Staff and Admin both land here)
const staffLinks = [
  { to: "/browse", label: "🔍 Browse Tenders" },
  { to: "/my-bids", label: "📌 My Active Bids" },
  { to: "/winning-bids", label: "🏆 My Winning Bids" },
];

// 👇 Extra links only shown once the logged-in user is an Admin
const adminLinks = [
  { to: "/admin", label: "🗂️ Manage Tenders" },
  { to: "/create-tender", label: "➕ Create New Tender" },
  { to: "/pending-approvals", label: "📋 Pending Approvals" },
  { to: "/expired-tenders", label: "⏰ Expired Tenders" },
  { to: "/registration-request", label: "📋 Registration Request" },
  { to: "/edit-user-details", label: "👤 Edit User Details" },
  { to: "/audit-reports", label: "📊 Audit Reports" },
  { to: "/audit-report-preview", label: "📄 Report Preview" },
];

function AppRoutes() {
  const location = useLocation();

  const currentUser = getCurrentUser();
  const userRole = currentUser?.role || "Staff";
  const sidebarLinks = userRole === "Admin" ? adminLinks : staffLinks;

  // 👈 2. Added /verify-email to public pages to hide sidebar
  const isPublicPage = 
    location.pathname === "/" || 
    location.pathname === "/register" || 
    location.pathname === "/verify-email" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";

  return (
    <>
      {!isPublicPage && <Sidebar links={sidebarLinks} />}

      <Routes>
        {/* ==================== 1. PUBLIC ROUTES ==================== */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} /> {/* 👈 3. Registered Route */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* ==================== 2. STAFF ACCESS BRANCH ==================== */}
        <Route element={<ProtectedRoute allowedRoles={["Staff","Bidder"]} />}>
          <Route path="/browse" element={<BrowseAssetsPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
          <Route path="/my-bids" element={<MyActiveBidsPage />} />
          <Route path="/winning-bids" element={<WinningBidsPage />} />
        </Route>

        {/* ==================== 3. ADMIN ACCESS BRANCH ==================== */}
        <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/create-tender" element={<CreateTenderPage />} />
          <Route path="/edit-tender" element={<EditTenderPage />} />
          <Route path="/pending-approvals" element={<Pendingapprovals />} />
          <Route path="/expired-tenders" element={<ExpiredTendersPage />} />
          <Route path="/registration-request" element={<RegistrationRequest />} />
          <Route path="/edit-user-details" element={<EditUserDetails/>} />
          <Route path="/user-management" element={<UserManagementPage />} />
          <Route path="/tender-detail/:listingId" element={<TenderDetailPage />} />
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

  const basename = process.env.NODE_ENV === "production" ? "/grp-03-15" : "";

  return (
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;