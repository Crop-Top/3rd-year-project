import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getCurrentUser } from "../services/authService";

function ProtectedRoute({ allowedRoles }) {
  const user = getCurrentUser();
  const currentLocation = useLocation();

  // 🛡️ GUARD 1: Not logged in -> Send to Landing / Login Page
  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          fromProtected: true,
          message: "Please log in to access this page.",
        }}
      />
    );
  }

  // Normalize role matching
  const userRoleNormalized = user.role?.toLowerCase();
  const isAllowed = allowedRoles?.some(
    (role) => role.toLowerCase() === userRoleNormalized
  );

  // 🛡️ GUARD 2: User doesn't have required role
  if (allowedRoles && !isAllowed) {
    // 1. If they navigated here from inside the app, send them back to where they were!
    // 2. If they typed the URL directly into a fresh tab, send them to their role home.
    const defaultHome = userRoleNormalized === "admin" ? "/admin" : "/browse";
    const previousPage = currentLocation.state?.from || defaultHome;

    return (
      <Navigate
        to={previousPage}
        replace
        state={{
          accessDenied: true,
          message: `Access Restricted: ${user.role} accounts cannot access ${currentLocation.pathname}.`,
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;