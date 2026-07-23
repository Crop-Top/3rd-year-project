// src/utils/jwtUtils.js
export const getUserRoleFromToken = (token) => {
  if (!token) return null;
  try {
    // JWT format: header.payload.signature
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);

    // ASP.NET Core maps roles to this claim URI or a standard "role" claim
    return (
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      decoded.role ||
      null
    );
  } catch (error) {
    console.error("Failed to parse token:", error);
    return null;
  }
};