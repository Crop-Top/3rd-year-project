# HANDOVER_DOCUMENTATION.md

## System Handover & Administrative Tasks

This document contains pending operational updates, environment configuration tasks, and administrative handovers for the **Asset Tender Portal**.

---

## 1. Pending Email Configuration Updates

### **Admin Notification Email Address**
The pending user registration email notification is currently configured with a placeholder/development address. Before handing off to production, update the destination address in `appsettings.json` on the deployment IIS server (`soit-iis.mandela.ac.za`).

* **Action Required:** Change `AdminNotificationEmail` under `SmtpSettings` to `assets@mandela.ac.za`.

```json
"SmtpSettings": {
  "Server": "osiris.nmmu.ac.za",
  "Port": 25,
  "SenderEmail": "noreply@mandela.ac.za",
  "SenderName": "Asset Tender Portal",
  "EnableSsl": false,
  "AdminNotificationEmail": "assets@mandela.ac.za"
}
```

* **Affected Workflow:** When a new user completes email verification, the system automatically sends a notification email containing the user's `FullName` and `Email` to `assets@mandela.ac.za` so administrators can review and approve the pending account.

---

## 2. General Deployment & Environment Notes

| Setting | Current Value / Reference | Notes |
| :--- | :--- | :--- |
| **Database Server** | `soit-sql.mandela.ac.za` | Production database instance (`grp-03-15`) |
| **Frontend Base URL** | `https://soit-iis.mandela.ac.za/grp-03-15/` | Used in email template links & redirects |
| **SMTP Relay Host** | `osiris.nmmu.ac.za` (Port 25) | Internal mail relay |

---

## 3. Maintenance & Support Tasks

* [ ] Verify SMTP outbound connectivity from the IIS server (`soit-iis.mandela.ac.za`) on Port 25.
* [ ] Update `AdminNotificationEmail` in production `appsettings.json` to `assets@mandela.ac.za`.
* [ ] Test end-to-end registration and email verification flow in production environment.
