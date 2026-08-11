import React, { useState, useEffect } from 'react';
import "../styles/component_style/EditUserDetailsModal.css";

const EditUserDetailsModal = ({ user, onSave, onCancel, onClose }) => {
  const isExternal = user?.userType === 'external' || user?.role === 'External';

  const [formData, setFormData] = useState({
    role: user?.role || '',
    status: user?.status || 'Active',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        role: user.role || '',
        status: user.status || 'Active',
      });
    }
  }, [user]);

  const nameParts = (user?.fullName || '').split(' ');
  const firstName = user?.firstName || nameParts[0] || '';
  const lastName = user?.lastName || nameParts.slice(1).join(' ') || '';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedPayload = isExternal
      ? { status: formData.status }
      : { role: formData.role, status: formData.status };

    onSave(updatedPayload);
  };

  if (!user) return null;

  return (
    <div className="eud-overlay" onClick={onClose}>
      <div
        className="eud-form-card eud-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eud-header-row">
          <div>
            <span className="eud-eyebrow">
              {isExternal ? 'External User' : 'Staff Member'}
            </span>
            <h2 className="eud-title" style={{ fontSize: '20px' }}>
              Edit User Details
            </h2>
          </div>
          <button
            type="button"
            className="eud-btn eud-btn-secondary"
            onClick={onClose}
            style={{ padding: '4px 10px', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* READ-ONLY: First Name & Surname */}
          <div className="eud-row">
            <div className="eud-field">
              <label className="eud-label">First Name</label>
              <input
                type="text"
                value={firstName}
                disabled
                className="eud-input"
                style={{ backgroundColor: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
              />
            </div>
            <div className="eud-field">
              <label className="eud-label">Surname</label>
              <input
                type="text"
                value={lastName}
                disabled
                className="eud-input"
                style={{ backgroundColor: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          {/* READ-ONLY: Email */}
          <div className="eud-field">
            <label className="eud-label">Email Address</label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="eud-input"
              style={{ backgroundColor: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
            />
          </div>

          {/* ROLE: Editable for Staff, Read-Only for External */}
          <div className="eud-field">
            <label className="eud-label">Role</label>
            {!isExternal ? (
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="eud-select"
              >
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Officer">Officer</option>
              </select>
            ) : (
              <input
                type="text"
                value={user.role || 'External'}
                disabled
                className="eud-input"
                style={{ backgroundColor: '#F3F4F6', color: '#6B7280', cursor: 'not-allowed' }}
              />
            )}
          </div>

          {/* STATUS: Editable for BOTH Staff and External */}
          <div className="eud-field">
            <label className="eud-label">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="eud-select"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          {/* ACTION BUTTONS */}
          <div className="eud-header-actions" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              className="eud-btn eud-btn-secondary"
              onClick={onCancel || onClose}
            >
              Cancel
            </button>
            <button type="submit" className="eud-btn eud-btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserDetailsModal;