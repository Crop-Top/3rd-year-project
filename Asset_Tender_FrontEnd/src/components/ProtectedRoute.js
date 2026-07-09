import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken } from "../services/authService"; 

function ProtectedRoute() {
    const isAuthenticated = !!getAccessToken(); 

    // If not authenticated, redirect home AND pass a state flag
    return isAuthenticated 
        ? <Outlet /> 
        : <Navigate to="/" replace state={{ fromProtected: true, message: "Please log in to access this page." }} />;
}

export default ProtectedRoute;