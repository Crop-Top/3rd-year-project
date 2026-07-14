import React, { useState } from "react";
import { register } from "../services/registrationService";
import "../styles/RegistrationPage.css";

const RegistrationPage = () => {
  const [form, setForm] = useState({
    company: "",
    email: "",
    password: "",
    confirm: ""
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

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

    if (!form.company) newErrors.company = "Company name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Invalid email.";
    if (form.password.length < 8)
      newErrors.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirm)
      newErrors.confirm = "Passwords do not match.";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setServerError("");
    setSuccess(false);

    try {
      const result = await register(form.company, form.email, form.password);

      if (result.success) {
        setSuccess(true);
        setForm({ company: "", email: "", password: "", confirm: "" });
        return;
      }

      if (result.status === 409) {
        setErrors({ email: result.data?.message || "An account with this email already exists." });
        return;
      }

      if (result.status === 400) {
        setServerError(result.data?.message || "Please check your input and try again.");
        return;
      }

      setServerError(result.data?.message || "Registration failed. Please try again.");
    } catch (err) {
      console.error(err);
      setServerError("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reg-container">

      {/* LOGO */}
      <div className="logo-wrap">
        <div className="logo-circle">R</div>
      </div>

      {/* CARD */}
      <div className="card">

        <h2>External Bidder Registration</h2>

        <div className="note">
          <strong>Note:</strong> Staff should use SSO login.
        </div>

        {success && (
          <div className="success-msg">
            Registration submitted. Your account is awaiting administrator approval.
          </div>
        )}

        {serverError && (
          <div className="error-msg">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <input
            name="company"
            placeholder="Company Name"
            value={form.company}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          {errors.company && <small className="error">{errors.company}</small>}

          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          {errors.email && <small className="error">{errors.email}</small>}

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          {errors.password && <small className="error">{errors.password}</small>}

          <input
            type="password"
            name="confirm"
            placeholder="Confirm Password"
            value={form.confirm}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          {errors.confirm && <small className="error">{errors.confirm}</small>}

          <button type="submit" className="btn-register" disabled={isSubmitting}>
            {isSubmitting ? "REGISTERING..." : "REGISTER"}
          </button>

        </form>

      </div>

      <p className="footer">© 2026 NMU</p>

    </div>
  );
};

export default RegistrationPage;
