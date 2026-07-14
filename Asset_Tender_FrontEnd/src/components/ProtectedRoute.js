import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentUser } from "../services/authService"; 

function ProtectedRoute({ allowedRoles }) {
    const user = getCurrentUser(); 

    // 🛡️ GUARD 1: Is the user logged in at all?
    if (!user) {
        // Keeps your exact original logic! Redirects home with the security flags
        return <Navigate 
            to="/" 
            replace 
            state={{ fromProtected: true, message: "Please log in to access this page." }} 
        />;
    }

    // 🛡️ GUARD 2: Does the user have permission to be here?
    // If an allowedRoles array was passed, check if the user's role matches
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Boot them away to the main asset page with an unauthorized notification
        return <Navigate 
            to="/browse" 
            replace 
            state={{ unauthorizedRole: true, message: `Access denied. ${user.role} accounts cannot view this resource.` }} 
        />;
    }

    // Success! Render the matching sub-pages safely
    return <Outlet />;
}

export default ProtectedRoute;