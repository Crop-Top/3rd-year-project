import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import BrowseAssetsPage from "./pages/BrowseAssetsPage";
import RegistrationPage from "./pages/RegistrationPage";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute"; // Make sure to create this component file!

function App() {
  return (
    <BrowserRouter>
      {/* Sidebar now only houses authentic pages; links to public forms are removed from here */}
      <Sidebar
        links={[
          { to: "/browse", label: "🔍 Browse Tenders" }
        ]}
      />
      
      <Routes>
        {/* ==================== PUBLIC ROUTES ==================== */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        {/* ==================== PROTECTED ROUTES ==================== */}
        {/* Any route placed inside this block will automatically require a valid JWT token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/browse" element={<BrowseAssetsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;