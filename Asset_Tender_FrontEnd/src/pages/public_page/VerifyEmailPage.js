import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
//import { apiFetch } from "../../services/apiClient";
import { apiFetch, API_BASE_URL } from '../../services/apiClient';

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState("Verifying your email address...");
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
        const response = await fetch("https://localhost:7276/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token })
        });

        // Safely extract response data
        const data = response.json ? await response.json() : response;

        if (response.ok || response.status === 200) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully! Your account is pending admin approval.");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed or token expired.");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "An unexpected error occurred during verification.");
      }
    };

    verify();
  }, [token, email]);

  return (
    <div style={{ maxWidth: "500px", margin: "80px auto", textAlign: "center", padding: "20px" }}>
      {status === "verifying" && <h2>⏳ Verifying your email...</h2>}
      
      {status === "success" && (
        <div>
          <h2 style={{ color: "#16a34a" }}>✅ Email Verified!</h2>
          <p>{message}</p>
          <button onClick={() => navigate("/login")} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>
            Return to Login
          </button>
        </div>
      )}

      {status === "error" && (
        <div>
          <h2 style={{ color: "#dc2626" }}>❌ Verification Failed</h2>
          <p>{message}</p>
          <button onClick={() => navigate("/login")} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default VerifyEmailPage;