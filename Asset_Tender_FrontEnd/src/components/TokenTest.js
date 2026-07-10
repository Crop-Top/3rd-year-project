import React, { useState, useEffect } from 'react';
import { getCurrentUser, getAccessToken } from '../services/authService'; 

// 🚨 CHANGE THIS LINE: Added 'default'
export default function TokenTest() {
    const [user, setUser] = useState(null);
    const [rawToken, setRawToken] = useState("");

    // Check for the token information when the component mounts on the page
    useEffect(() => {
        const activeUser = getCurrentUser();
        const token = getAccessToken();

        setUser(activeUser);
        setRawToken(token);
    }, []);

    return (
        <div style={{ padding: '20px', background: '#222', color: '#fff', borderRadius: '8px', margin: '20px 0', fontFamily: 'monospace' }}>
            <h2 style={{ color: '#4caf50', marginTop: 0 }}>🚨 JWT Claims Testing Sandbox</h2>
            <p>If these areas are blank, make sure you are logged in first!</p>
            
            <hr style={{ borderColor: '#444' }} />

            {/* 1. Displays your cleaned up User Data Object */}
            <h3>1. Parsed User Object (via getCurrentUser)</h3>
            {user ? (
                <pre style={{ background: '#333', padding: '10px', borderRadius: '4px' }}>
                    {JSON.stringify(user, null, 2)}
                </pre>
            ) : (
                <p style={{ color: '#ff9800' }}>No active user claims found. Token might be missing or corrupt.</p>
            )}

            {/* 2. Displays the raw encrypted JWT token string */}
            <h3>2. Raw JWT String (via getAccessToken)</h3>
            <div style={{ wordBreak: 'break-all', background: '#333', padding: '10px', borderRadius: '4px', fontSize: '12px', color: '#00bcd4' }}>
                {rawToken || "No token in application memory."}
            </div>
        </div>
    );
}