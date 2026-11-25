import { apiClient } from './client';
import {
  getLocalReport,
  listLocalReports,
  removeLocalInterviewData,
  saveLocalReport,
} from '../offline/localInterviewStore';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
import { cancelQueuedInterview, enqueueSyncOperation } from '../offline/syncQueue';

function filenameFromContentDisposition(header) {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded.replace(/^["']|["']$/g, '')); } catch { return encoded; }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] || null;
}

function localReportId(id) {
  return String(id).startsWith('local_') || String(id).startsWith('mock_');
}

function scoreOf(report) {
  const value = Number(report.scores?.total ?? report.totalScore ?? report.score);
  return Number.isFinite(value) ? value : null;
}

async function cacheReport(report) {
  if (!report?.id) throw new Error('The server returned a report without an ID.');
  const cached = await getLocalReport(report.id);
  return saveLocalReport({ ...cached, ...report });
}

function periodStart(date, period) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === 'monthly') return new Date(start.getFullYear(), start.getMonth(), 1);
  const day = start.getDay();
  start.setDate(start.getDate() - ((day + 6) % 7));
  return start;
}

function periodKey(date, period) {
  const start = periodStart(date, period);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function periodLabel(date, period) {
  return new Intl.DateTimeFormat(undefined, period === 'monthly'
    ? { month: 'short', year: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date);
}

function buildProgress(reports, period = 'weekly') {
  const normalizedPeriod = period === 'monthly' ? 'monthly' : 'weekly';
  const count = normalizedPeriod === 'monthly' ? 12 : 8;
  const currentStart = periodStart(new Date(), normalizedPeriod);
  const points = Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    const start = new Date(currentStart);
    if (normalizedPeriod === 'monthly') start.setMonth(start.getMonth() - offset);
    else start.setDate(start.getDate() - (offset * 7));
    const key = periodKey(start, normalizedPeriod);
    return { key, label: periodLabel(start, normalizedPeriod), total: [], content: [], communication: [], interviews: 0 };
  });
  const byKey = new Map(points.map((point) => [point.key, point]));
  for (const report of reports) {
    const date = new Date(report.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = byKey.get(periodKey(date, normalizedPeriod));
    const total = scoreOf(report);
    if (!bucket || total === null) continue;
    bucket.total.push(total);
    const content = Number(report.scores?.content ?? report.contentScore);
    const communication = Number(report.scores?.communication ?? report.communicationScore);
    if (Number.isFinite(content)) bucket.content.push(content);
    if (Number.isFinite(communication)) bucket.communication.push(communication);
    bucket.interviews += 1;
  }
  const averages = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const data = points.map((point) => ({
    key: point.key,
    label: point.label,
    total: averages(point.total),
    content: averages(point.content),
    communication: averages(point.communication),
    interviews: point.interviews,
  }));
  const latest = data[data.length - 1]?.total || 0;
  const previous = data[data.length - 2]?.total || 0;
  return { period: normalizedPeriod, points: data, improvement: latest - previous };
}

function completeProgressPeriods(payload, requestedPeriod) {
  const period = payload.period === 'monthly' || requestedPeriod === 'monthly' ? 'monthly' : 'weekly';
  const defaults = buildProgress([], period).points;
  const source = Array.isArray(payload.points) ? payload.points : [];
  const byKey = new Map(defaults.map((point) => [point.key, { ...point }]));
  const unmatched = [];
  for (const point of source) {
    const rawDate = point.key || point.date || point.startDate;
    const key = rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? periodKey(new Date(rawDate), period)
      : null;
    const target = key ? byKey.get(key) : null;
    if (target) {
      Object.assign(target, point, {
        key: target.key,
        label: point.label || target.label,
        total: Number(point.total ?? point.averageScore ?? point.score) || 0,
        content: Number(point.content ?? point.contentScore) || 0,
        communication: Number(point.communication ?? point.communicationScore) || 0,
        interviews: Number(point.interviews ?? point.count) || 0,
      });
    } else {
      unmatched.push(point);
    }
  }
  if (unmatched.length) {
    const available = [...byKey.values()].filter((point) => !source.some((item) => {
      const date = item.key || item.date || item.startDate;
      return date && periodKey(new Date(date), period) === point.key;
    }));
    unmatched.slice(-available.length).forEach((point, index) => {
      const target = available[available.length - unmatched.slice(-available.length).length + index];
      Object.assign(target, {
        label: point.label || target.label,
        total: Number(point.total ?? point.averageScore ?? point.score) || 0,
        content: Number(point.content ?? point.contentScore) || 0,
        communication: Number(point.communication ?? point.communicationScore) || 0,
        interviews: Number(point.interviews ?? point.count) || 0,
      });
    });
  }
  const points = [...byKey.values()];
  const improvement = points[points.length - 1].total - points[points.length - 2].total;
  return { ...payload, period, points, improvement: Number(payload.improvement ?? improvement) || 0 };
}

const realReportsApi = {
  async list(filters = {}) {
    const response = await apiClient.get('/reports', { params: filters });
    const payload = response.data;
    const items = Array.isArray(payload) ? payload : payload?.items || payload?.reports || [];
    await Promise.all(items.map(cacheReport));
    return {
      items,
      pagination: response.pagination || payload?.pagination,
      offline: false,
    };
  },
  async get(id) {
    const response = await apiClient.get(`/reports/${encodeURIComponent(id)}`);
    const report = response.data?.report || response.data;
    await cacheReport(report);
    return { report, offline: false };
  },
  async download(id) {
    const response = await apiClient.get(`/reports/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromContentDisposition(response.headers?.['content-disposition']),
      offline: false,
    };
  },
  async progress(filters = {}) {
    const response = await apiClient.get('/reports/progress', { params: filters });
    return { ...completeProgressPeriods(response.data || {}, filters.period), offline: false };
  },
  async remove(id) {
    const { report } = await this.get(id);
    await apiClient.delete(`/interviews/${encodeURIComponent(report.interviewId)}`);
    await cancelQueuedInterview(report.interviewId);
    await removeLocalInterviewData(report.interviewId, id);
    return { id, offline: false };
  },
};

function shouldFallback(error) {
  return error?.code === 'NETWORK_ERROR' || error?.status >= 500;
}

async function localList(filters = {}) {
  const reports = await listLocalReports();
  const filtered = reports.filter((report) => (
    (!filters.category || report.category === filters.category)
    && (!filters.from || String(report.createdAt || '').slice(0, 10) >= String(filters.from))
    && (!filters.to || String(report.createdAt || '').slice(0, 10) <= String(filters.to))
  )).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Number(filters.limit) || 20);
  const pages = Math.ceil(filtered.length / limit);
  const currentPage = pages ? Math.min(page, pages) : 1;
  return {
    items: filtered.slice((currentPage - 1) * limit, currentPage * limit),
    pagination: { page: currentPage, limit, total: filtered.length, pages },
    offline: true,
  };
}

const localReportsApi = {
  list: localList,
  async get(id) {
    const report = await getLocalReport(id);
    if (!report) {
      const error = new Error('Report not found in saved interview data.');
      error.status = 404;
      error.code = 'REPORT_NOT_FOUND';
      throw error;
    }
    return { report, offline: true };
  },
  async download(id) {
    const { report } = await this.get(id);
    return { report, offline: true };
  },
  async progress(filters = {}) {
    const reports = await listLocalReports();
    return { ...buildProgress(reports, filters.period), offline: true };
  },
  async remove(id) {
    const { report } = await this.get(id);
    await cancelQueuedInterview(report.interviewId);
    if (!localReportId(report.interviewId) && !isGuest() && getStoredToken()
      && typeof navigator !== 'undefined' && navigator.onLine
      && import.meta.env.VITE_USE_MOCK !== 'true') {
      await apiClient.delete(`/interviews/${encodeURIComponent(report.interviewId)}`);
    }
    await removeLocalInterviewData(report.interviewId, id);
    if (!localReportId(report.interviewId) && !isGuest() && getStoredToken()
      && typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueSyncOperation('interview.remove', { localId: report.interviewId }, {
        localId: report.interviewId,
        idempotencyKey: `interview.remove:${report.interviewId}`,
      });
    }
    return { id, offline: true };
  },
};

function isGuest() {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true';
}

function selectApi() {
  if (localStorage.getItem(GUEST_MODE_KEY) === 'true'
    || (typeof navigator !== 'undefined' && !navigator.onLine)
    || !getStoredToken()) return localReportsApi;
  if (import.meta.env.VITE_USE_MOCK === 'true') return localReportsApi;
  return realReportsApi;
}

async function invoke(method, args) {
  const selected = ['get', 'download', 'remove'].includes(method) && localReportId(args[0])
    ? localReportsApi
    : selectApi();
  try {
    return await selected[method](...args);
  } catch (error) {
    if (method === 'remove') throw error;
    if (selected === localReportsApi || import.meta.env.VITE_USE_MOCK === 'true' || !shouldFallback(error)) throw error;
    return localReportsApi[method](...args);
  }
}

export const reportsApi = {
  list: (...args) => invoke('list', args),
  get: (...args) => invoke('get', args),
  download: (...args) => invoke('download', args),
  progress: (...args) => invoke('progress', args),
  remove: (...args) => invoke('remove', args),
};
