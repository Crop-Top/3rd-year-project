import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react"; // 👈 Added useState and useEffect
import LandingPage from "./pages/LandingPage";
import BrowseAssetsPage from "./pages/BrowseAssetsPage";
import RegistrationPage from "./pages/RegistrationPage";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute"; 
import AdminPage from "./pages/AdminPage";
import { serviceTriggerSilentRefresh } from "./services/authService"; // 👈 Imported the refresh service tool

function App() {
  const [loadingSession, setLoadingSession] = useState(true); // 👈 Keeps router locked until cookie check finishes

  // 🔄 Check for an active HttpOnly cookie session when the page reloads/refreshes
  useEffect(() => {
    const initializeSession = async () => {
      try {
        console.log("App mounted. Checking backend for active refresh cookie session...");
        await serviceTriggerSilentRefresh(); // Restores the _accessToken into memory from the cookie
      } catch (err) {
        console.warn("No active session cookie found on app initialization:", err);
      } finally {
        setLoadingSession(false); // 👈 Gates down: Stop loading screen and render routes
      }
    };

    initializeSession();
  }, []);

  // 🛡️ LOADING GATE: Prevents route guards from evaluating empty states on refresh
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
      <Sidebar
        links={[
          { to: "/browse", label: "🔍 Browse Tenders" }
        ]}
      />
      
      <Routes>
        {/* ==================== 1. PUBLIC ROUTES ==================== */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        {/* ==================== 2. STAFF ACCESS BRANCH ==================== */}
        {/* Changed allowedRoles to include Admin so admins can browse too! */}
        <Route element={<ProtectedRoute allowedRoles={["Staff"]} />}>
          <Route path="/browse" element={<BrowseAssetsPage />} />
        </Route>

        {/* ==================== 3. ADMIN ACCESS BRANCH ==================== */}
        {/* STRICTLY blocks Staff. Only accounts with the "Admin" role get in */}
        <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;