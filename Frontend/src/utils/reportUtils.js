export function reportScore(report, key = 'total') {
  const field = key === 'total' ? 'totalScore' : `${key}Score`;
  const value = Number(report?.scores?.[key] ?? report?.[field] ?? (key === 'total' ? report?.score : undefined));
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export function scoreTone(score) {
  const value = Number(score) || 0;
  if (value < 40) return 'danger';
  if (value < 70) return 'warning';
  return 'success';
}

export function evaluationMethodKey(method) {
  return method === 'local-rule-based-v1' ? 'reports.methodLocal' : 'reports.methodServer';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildReportsCsv(reports, labels = {}) {
  const headings = [
    labels.date || 'Date',
    labels.title || 'Title',
    labels.category || 'Category',
    labels.total || 'Total',
    labels.content || 'Content',
    labels.communication || 'Communication',
  ];
  const rows = reports.map((report) => [
    report.createdAt || '',
    report.title || '',
    report.category || '',
    reportScore(report, 'total'),
    reportScore(report, 'content'),
    reportScore(report, 'communication'),
  ]);
  return [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function reportFilename(report) {
  const safeTitle = String(report?.title || 'talkready-report')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'talkready-report';
  return `${safeTitle}.pdf`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

