import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import RegistrationPage from "./RegistrationPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationPage />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;