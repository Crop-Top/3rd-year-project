import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/apiClient";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState("Verifying your email address...");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    const verify = async () => {
      try {
        const response = await apiFetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token })
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("An unexpected error occurred.");
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
          <button onClick={() => navigate("/login")} style={{ marginTop: "16px" }}>
            Return to Login
          </button>
        </div>
      )}

      {status === "error" && (
        <div>
          <h2 style={{ color: "#dc2626" }}>❌ Verification Failed</h2>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}

export default VerifyEmailPage;