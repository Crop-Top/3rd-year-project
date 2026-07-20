import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import BrowseAssetsPage from "./pages/BrowseAssetsPage";
import RegistrationPage from "./pages/RegistrationPage";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import CreateTenderPage from "./pages/CreateTenderPage";
import Pendingapprovals from "./pages/Pendingapprovals";
import AssetDetailPage from "./pages/AssetDetailPage";
import UserManagementPage from "./pages/UserManagementPage";
import { serviceTriggerSilentRefresh } from "./services/authService";

// 👇 Links shown to everyone (Staff and Admin both land here)
const staffLinks = [{ to: "/browse", label: "🔍 Browse Tenders" }];

// 👇 Extra links only shown once the logged-in user is an Admin
const adminLinks = [
  { to: "/browse", label: "🔍 Browse Tenders" },
  { to: "/admin", label: "🗂️ Manage Tenders" },
  { to: "/create-tender", label: "➕ Create New Tender" },
  { to: "/pending-approvals", label: "📋 Pending Approvals" },
];

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

  // ROLE CHECK: Determines which sidebar links render (admin-only links included or not).
  // (Replace this line with your actual role getter — e.g. from a decoded token or auth context)
  const userRole = localStorage.getItem("userRole") || "Staff"; // Temporary flag — swap with real role source
  const sidebarLinks = userRole === "Admin" ? adminLinks : staffLinks;

  return (
    <BrowserRouter>
      <Sidebar links={sidebarLinks} />

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
          <Route path="/create-tender" element={<CreateTenderPage />} /> {/* 👈 added */}
          <Route path="/pending-approvals" element={<Pendingapprovals />} /> {/* 👈 added */}
          <Route path="/user-management" element={<UserManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;