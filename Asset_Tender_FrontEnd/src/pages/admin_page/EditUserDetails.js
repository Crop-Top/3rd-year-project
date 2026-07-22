import React, { useState } from 'react';
import "../../styles/admin_style/EditingUserDetails.css";

const MOCK_USERS = [
  {
    id: 1,
    fullName: 'Sarah Madiba',
    username: 's.madiba',
    email: 's.madiba@logistics.co',
    role: 'Staff',
    status: 'Active',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    photoUploadedOn: 'Nov 12, 2024',
  },
  {
    id: 2,
    fullName: 'Thabo Nkosi',
    username: 't.nkosi',
    email: 't.nkosi@logistics.co',
    role: 'Admin',
    status: 'Active',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    photoUploadedOn: 'Feb 3, 2025',
  },
  {
    id: 3,
    fullName: 'Lindiwe Dube',
    username: 'l.dube',
    email: 'l.dube@logistics.co',
    role: 'Manager',
    status: 'Suspended',
    photoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200',
    photoUploadedOn: 'May 21, 2025',
  },
];

const statusClass = (status) => {
  if (status === 'Active') return 'um-status um-status-active';
  if (status === 'Suspended') return 'um-status um-status-suspended';
  return 'um-status um-status-inactive';
};

const EditingUserDetailsPage = () => {
  const [users, setUsers] = useState(MOCK_USERS);
  const [activeUser, setActiveUser] = useState(null);

  const openEdit = (user) => setActiveUser(user);
  const closeEdit = () => setActiveUser(null);

  const handleSave = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === activeUser.id ? { ...u, ...updatedUser } : u))
    );
    closeEdit();
  };

  return (
    <div className="um-layout">
      <div className="um-main">
        <header className="um-topbar">
          <h1 className="um-topbar-title">User Management</h1>
          <div className="um-topbar-profile">
            <div className="um-topbar-avatar">A</div>
            <span className="um-topbar-name">Admin</span>
          </div>
        </header>

        <div className="um-content">
          <div className="um-content-header">
            <p className="um-content-subtitle">
              Manage staff accounts, roles, and access status across the portal.
            </p>
            <span className="um-count-badge">{users.length} users</span>
          </div>

          <div className="um-table">
            <div className="um-table-head">
              <span>Name</span>
              <span>Username</span>
              <span>Role</span>
              <span>Status</span>
              <span className="um-table-head-action">Action</span>
            </div>

            {users.map((user) => (
              <div className="um-table-row" key={user.id}>
                <span className="um-table-user">
                  <img src={user.photoUrl} alt={user.fullName} className="um-table-avatar" />
                  {user.fullName}
                </span>
                <span className="um-table-username">{user.username}</span>
                <span className="um-table-role">{user.role}</span>
                <span className={statusClass(user.status)}>{user.status}</span>
                <button
                  type="button"
                  className="um-edit-btn"
                  onClick={() => openEdit(user)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
{/* 
      {activeUser && (
        <EditUserDetailsModal
          user={activeUser}
          onSave={handleSave}
          onCancel={closeEdit}
          onClose={closeEdit}
        />
      )}
       */}
    </div>
  );
};

export default EditingUserDetailsPage;