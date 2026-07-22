import React from 'react';
import "../../styles/admin_style/AdminLayout.css";

/**
 * AdminLayout
 *
 * Topbar + content shell for the UniAsset Admin pages.
 * Note: this does NOT render a sidebar — the app already has a global
 * <Sidebar links={...} /> rendered once in AppRoutes (App.js), fed by
 * the adminLinks/staffLinks arrays. Adding a second sidebar here would
 * duplicate it, so this component only wraps the topbar and page content.
 *
 * Props:
 *  - pageLabel: string shown next to the home icon in the topbar breadcrumb
 *  - children: page content
 */
const AdminLayout = ({ pageLabel, children }) => {
  return (
    <div className="al-layout">
      <div className="al-main">
        <header className="al-topbar">
          <div className="al-topbar-left">
            <span className="al-home-icon">⌂</span>
            <span className="al-topbar-title">{pageLabel}</span>
          </div>
          <div className="al-topbar-right">
            <div className="al-search">
              <span className="al-search-icon">⌕</span>
              <input type="text" placeholder="Search..." className="al-search-input" />
            </div>
            <button type="button" className="al-icon-btn" aria-label="Notifications">🔔</button>
            <button type="button" className="al-icon-btn" aria-label="Help">?</button>
            <div className="al-avatar">UA</div>
          </div>
        </header>

        <main className="al-content">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;