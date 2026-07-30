import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import "../../styles/public_style/RegistrationPage.css";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await forgotPassword(email.trim());
      setSubmitted(true);
      setServerMessage(
        result.data?.message ||
          "If an account exists, a reset link has been sent."
      );
    } catch (err) {
      console.error(err);
      setError("Unable to send reset request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reg-container">
      <div className="logo-wrap">
        <div className="logo-circle">R</div>
      </div>

      <div className="card">
        <h2>Forgot Password</h2>

        <div className="note">
          <strong>Note:</strong> Password reset is for external bidder accounts only.
          Staff should use Active Directory sign-in.
        </div>

        {submitted ? (
          <div className="success-msg">
            <p>{serverMessage}</p>
            <button
              type="button"
              className="btn-register"
              onClick={() => navigate("/")}
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              name="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
            />
            {error && <div className="error">{error}</div>}

            <button
              type="submit"
              className="btn-register"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {!submitted && (
          <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px" }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                background: "none",
                border: "none",
                color: "#0a1f44",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                fontSize: "13px"
              }}
            >
              Back to Sign In
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
