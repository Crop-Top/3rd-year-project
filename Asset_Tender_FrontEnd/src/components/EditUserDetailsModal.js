import React, { useState } from 'react';
import "../styles/component_style/EditUserDetailsModal.css";

/**
 * EditUserDetailsModal
 *
 * Props:
 *  - user: { fullName, username, email, role, status, photoUrl, photoUploadedOn }
 *  - onSave: (updatedUser) => void
 *  - onCancel: () => void
 *  - onClose: () => void
 *  - onChangeImage: () => void
 *  - isOpen: boolean
 */
const EditUserDetailsModal = ({ user, onSave, onCancel, onClose, onChangeImage, isOpen = true }) => {
  const [formData, setFormData] = useState({ ...user });

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSave = () => {
    if (onSave) onSave(formData);
  };

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h2 className="edit-modal-title">Edit User Details</h2>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="edit-modal-row">
          <div className="edit-modal-field">
            <label className="edit-modal-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="edit-modal-input"
              value={formData.fullName}
              onChange={handleChange('fullName')}
            />
          </div>
          <div className="edit-modal-field">
            <label className="edit-modal-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="edit-modal-input"
              value={formData.username}
              onChange={handleChange('username')}
            />
          </div>
        </div>

        <div className="edit-modal-row">
          <div className="edit-modal-field edit-modal-field-full">
            <label className="edit-modal-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="edit-modal-input"
              value={formData.email}
              onChange={handleChange('email')}
            />
          </div>
        </div>

        <div className="edit-modal-row">
          <div className="edit-modal-field">
            <label className="edit-modal-label" htmlFor="role">Role</label>
            <select
              id="role"
              className="edit-modal-input edit-modal-select"
              value={formData.role}
              onChange={handleChange('role')}
            >
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
          <div className="edit-modal-field">
            <label className="edit-modal-label" htmlFor="status">Status</label>
            <select
              id="status"
              className="edit-modal-input edit-modal-select"
              value={formData.status}
              onChange={handleChange('status')}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="edit-modal-photo-row">
          <img src={formData.photoUrl} alt={formData.fullName} className="edit-modal-avatar" />
          <div className="edit-modal-photo-info">
            <span className="edit-modal-photo-label">Profile Photo</span>
            <span className="edit-modal-photo-date">Uploaded on {formData.photoUploadedOn}</span>
            <button type="button" className="edit-modal-change-link" onClick={onChangeImage}>
              Change Image
            </button>
          </div>
        </div>

        <div className="edit-modal-footer">
          <button type="button" className="edit-modal-btn edit-modal-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="edit-modal-btn edit-modal-btn-save" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditUserDetailsModal;