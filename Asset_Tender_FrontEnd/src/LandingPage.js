import React, { useState } from "react";
import "./LandingPage.css";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Pulling variables from process.env for Create React App
  const API_BASE = process.env.REACT_APP_API_BASE || "";
  const USER_API = process.env.REACT_APP_USER_API || "";

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Log this to see exactly what URL React is trying to hit
      console.log("Fetching URL:", `${API_BASE}${USER_API}`);

      const res = await fetch(`${API_BASE}${USER_API}`);
      
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      setUsers(data);

    } catch (err) {
      console.error("Fetch Error:", err);
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>

      {/* NAV */}
      <nav className="nav">
        <span className="nav-brand">Asset Tender Portal</span>

        <ul className="nav-links">
          <li>Home</li>
          <li>Tenders</li>
          <li>About</li>
        </ul>

        <div className="nav-right">
          <button
            className="btn-signin"
            onClick={() => navigate("/register")}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <p>
            Welcome to the Asset Tender Portal. Browse and bid on university assets.
          </p>

          <button className="btn-explore">
            Explore Tenders
          </button>

          <button className="btn-explore" onClick={loadUsers}>
            {loading ? "Loading..." : "Load Users"}
          </button>
        </div>

        <h1 className="hero-title">
          Asset Tender Portal
        </h1>
      </section>

      {/* USERS */}
      <section className="section">
        <h2>Users</h2>

        <div className="users-list">
          {users.map((u, index) => (
            <div key={index} className="user-card">
              <strong>{u.username}</strong>
              <br />
              <small>{u.email}</small>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default LandingPage;