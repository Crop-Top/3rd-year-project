import { apiFetch, API_BASE_URL } from './apiClient';

function buildQuery(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function parseError(response) {
  try {
    const data = await response.json();
    return data.message || data.Message || 'Failed to generate report.';
  } catch {
    return 'Failed to generate report.';
  }
}

export async function fetchReport(reportType, startDate, endDate) {
  let response;
  try {
    response = await apiFetch(
      `${API_BASE_URL}/admin/reports/${reportType}${buildQuery(startDate, endDate)}`
    );
  } catch (err) {
    throw new Error(
      'Could not reach the report API. Check that the backend is running and your session is still active.'
    );
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function downloadReportCsv(reportType, startDate, endDate) {
  let response;
  try {
    response = await apiFetch(
      `${API_BASE_URL}/admin/reports/${reportType}/export.csv${buildQuery(startDate, endDate)}`
    );
  } catch (err) {
    throw new Error(
      'Could not reach the report API. Check that the backend is running and your session is still active.'
    );
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] || `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const REPORT_TYPES = [
  {
    key: 'disposal-outcomes',
    icon: '↺',
    title: 'Asset Disposal Outcomes',
    description: 'Completed tenders and disposal outcomes for surplus assets.',
    requiresDateRange: true,
  },
  {
    key: 'tender-register',
    icon: '📋',
    title: 'Tender Register',
    description: 'Master list of tenders published or started in the selected period.',
    requiresDateRange: true,
  },
  {
    key: 'offer-register',
    icon: '📨',
    title: 'Offer Register',
    description: 'Sealed offers submitted with bidder, amount, and timestamp.',
    requiresDateRange: true,
  },
  {
    key: 'expired-unsold',
    icon: '⏰',
    title: 'Expired & Unsold Assets',
    description: 'Expired lots with no bids that still need action.',
    requiresDateRange: false,
  },
  {
    key: 'user-summary',
    icon: '👥',
    title: 'User & Registration Summary',
    description: 'Account status and role breakdown across all platform users.',
    requiresDateRange: false,
  },
  {
    key: 'financial-recovery',
    icon: '🏛',
    title: 'Financial Recovery Summary',
    description: 'Leading bids versus recommended price on closed tenders.',
    requiresDateRange: true,
  },
  {
    key: 'user-activity',
    icon: '👤',
    title: 'User Activity Log',
    description: 'Administrative actions recorded in the audit change log.',
    requiresDateRange: true,
  },
];

export function getReportTypeMeta(reportType) {
  return REPORT_TYPES.find((t) => t.key === reportType) || null;
}
