import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch, API_BASE_URL } from "../../services/apiClient";
import { resendVerificationEmail } from "../../services/authService";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState("Verifying your email address...");
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  // Prevents React 18 Strict Mode double-firing in dev
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setMessage("Invalid verification link. Token or email parameter is missing.");
      return;
    }

    if (hasRun.current) return;
    hasRun.current = true;

    const verify = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/Auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });

        const data = await response.json().catch(() => ({}));
        const apiMessage = data.message || data.Message;

        if (response.ok) {
          setStatus("success");
          setMessage(
            apiMessage ||
              "Email verified successfully! Your account is pending admin approval."
          );
        } else {
          setStatus("error");
          setMessage(apiMessage || "Verification failed or token expired.");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "An unexpected error occurred during verification.");
      }
    };

    verify();
  }, [token, email]);

  const handleResend = async () => {
    if (!email) return;

    setResending(true);
    try {
      const result = await resendVerificationEmail(email);
      setMessage(
        result.data?.message ||
          "If an unverified account exists for that email, a new verification link has been sent."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "80px auto", textAlign: "center", padding: "20px" }}>
      {status === "verifying" && <h2>Verifying your email...</h2>}

      {status === "success" && (
        <div>
          <h2 style={{ color: "#16a34a" }}>Email Verified!</h2>
          <p>{message}</p>
          <button
            onClick={() => navigate("/")}
            style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}
          >
            Return to Login
          </button>
        </div>
      )}

      {status === "error" && (
        <div>
          <h2 style={{ color: "#dc2626" }}>Verification Failed</h2>
          <p>{message}</p>
          {email && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{ marginTop: "16px", marginRight: "8px", padding: "8px 16px", cursor: resending ? "not-allowed" : "pointer" }}
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default VerifyEmailPage;
