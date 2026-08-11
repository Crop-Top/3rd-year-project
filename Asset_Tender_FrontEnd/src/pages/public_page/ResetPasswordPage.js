import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import Portalheader from "../../components/Portalheader";
import Portalfooter from "../../components/Portalfooter";
import "../../styles/public_style/RegistrationPage.css";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({
    password: "",
    confirm: ""
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
    setErrors({
      ...errors,
      [e.target.name]: ""
    });
    setServerError("");
  };

  const validate = () => {
    const newErrors = {};

    if (!token) {
      newErrors.token = "Reset link is missing or invalid.";
    }
    if (form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }
    if (form.password !== form.confirm) {
      newErrors.confirm = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError("");

    try {
      const result = await resetPassword(token, form.password);

      if (result.success) {
        setSuccess(true);
        setSuccessMessage(
          result.data?.message ||
            "Password has been reset successfully. You can now sign in."
        );
        return;
      }

      setServerError(
        result.data?.message || "Invalid or expired reset token."
      );
    } catch (err) {
      console.error(err);
      setServerError("Unable to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="reg-page">
        <Portalheader />
        <div className="reg-container">
          <div className="logo-wrap">
            <div className="logo-circle">R</div>
          </div>
          <div className="card">
            <h2>Reset Password</h2>
            <div className="error" style={{ fontSize: "13px", marginTop: "10px" }}>
              This reset link is missing or invalid. Please request a new one.
            </div>
            <button
              type="button"
              className="btn-register"
              onClick={() => navigate("/forgot-password")}
            >
              Request New Link
            </button>
          </div>
        </div>
        <Portalfooter />
      </div>
    );
  }

  return (
    <div className="reg-page">
      <Portalheader />

      <div className="reg-container">
        <div className="logo-wrap">
          <div className="logo-circle">R</div>
        </div>

        <div className="card">
          <h2>Reset Password</h2>

          {success ? (
            <div className="success-msg">
              <p>{successMessage}</p>
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
              <label htmlFor="reset-password">New Password</label>
              <input
                id="reset-password"
                type="password"
                name="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                required
              />
              {errors.password && <div className="error">{errors.password}</div>}

              <label htmlFor="reset-confirm">Confirm Password</label>
              <input
                id="reset-confirm"
                type="password"
                name="confirm"
                placeholder="Re-enter password"
                value={form.confirm}
                onChange={handleChange}
                required
              />
              {errors.confirm && <div className="error">{errors.confirm}</div>}
              {serverError && <div className="error">{serverError}</div>}

              <button
                type="submit"
                className="btn-register"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      </div>

      <Portalfooter />
    </div>
  );
};

export default ResetPasswordPage;