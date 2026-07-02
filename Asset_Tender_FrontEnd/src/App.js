import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import BrowseAssetsPage from "./pages/BrowseAssetsPage";
import RegistrationPage from "./pages/RegistrationPage";
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <BrowserRouter>
      <Sidebar
        links={[
          { to: "/", label: "Landing" },
          { to: "/register", label: "Register" },
          { to: "/browse", label: "Browse Tenders" }
        ]}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/browse" element={<BrowseAssetsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;