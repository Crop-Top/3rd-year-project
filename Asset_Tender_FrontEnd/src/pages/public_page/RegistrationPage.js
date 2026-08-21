import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../../services/registrationService";
import PortalHeader from "../../components/Portalheader";
import PortalFooter from "../../components/Portalfooter";
import "../../styles/public_style/RegistrationPage.css";

const RegistrationPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    company: "",
    email: "",
    password: "",
    confirm: ""
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!success) return undefined;

    setRedirectSeconds(5);
    const intervalId = setInterval(() => {
      setRedirectSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    const timeoutId = setTimeout(() => navigate("/"), 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [success, navigate]);

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
    <div className="reg-page">
      <PortalHeader />

      <div className="reg-container">
       

        {/* CARD */}
        <div className="card">
          <h2>External Bidder Registration</h2>

          <div className="note">
            <strong>Note:</strong> Staff should log in on the main page with their username and password.
          </div>

          {success && (
            <div className="success-msg">
              Registration submitted. Please check your email to verify your address. After verification, your account will await administrator approval.
              {" "}Redirecting to login in {redirectSeconds}s…
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
              disabled={isSubmitting || success}
            />
            {errors.company && <small className="error">{errors.company}</small>}

            <input
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              disabled={isSubmitting || success}
            />
            {errors.email && <small className="error">{errors.email}</small>}

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              disabled={isSubmitting || success}
            />
            {errors.password && <small className="error">{errors.password}</small>}

            <input
              type="password"
              name="confirm"
              placeholder="Confirm Password"
              value={form.confirm}
              onChange={handleChange}
              disabled={isSubmitting || success}
            />
            {errors.confirm && <small className="error">{errors.confirm}</small>}

            <button type="submit" className="btn-register" disabled={isSubmitting || success}>
              {isSubmitting ? "REGISTERING..." : "REGISTER"}
            </button>

            <button
              type="button"
              className="btn-back"
              onClick={() => navigate("/")}
              disabled={isSubmitting}
            >
              BACK TO HOME
            </button>
          </form>
        </div>
      </div>

      <PortalFooter />
    </div>
  );
};

export default RegistrationPage;
