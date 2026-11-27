import { apiClient } from './client';
import { GUEST_MODE_KEY, getStoredToken } from '../../utils/authStorage';
import { deleteRecord, getRecord, getAllRecords, putRecord } from '../offline/db';

function assertResumeAccess() {
  if (localStorage.getItem(GUEST_MODE_KEY) === 'true' || !getStoredToken()) {
    const error = new Error('Sign in to upload and manage resumes.');
    error.code = 'RESUME_ACCOUNT_REQUIRED';
    throw error;
  }
  if (!navigator.onLine) {
    const error = new Error('Resume upload and extraction require an internet connection.');
    error.code = 'RESUME_NETWORK_REQUIRED';
    throw error;
  }
}

function resumeFrom(response) {
  const resume = response.data?.resume || response.data?.item || response.data;
  if (!resume?.id) throw new Error('The server returned an invalid resume.');
  return resume;
}

function itemsFrom(response) {
  const payload = response.data;
  return Array.isArray(payload) ? payload : payload?.items || payload?.resumes || [];
}

async function cacheResume(resume) {
  await putRecord('resumes', resume);
  return resume;
}

function makeMockId() {
  return `mock_resume_${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

const mockExtraction = {
  education: [{ degree: 'Bachelor of Technology', institution: 'Sample University' }],
  skills: ['JavaScript', 'React', 'Communication'],
  projects: [{ title: 'Sample project', description: 'A project included in mock resume extraction.' }],
  experience: [{ title: 'Software Developer', organization: 'Sample Company' }],
};

export const mockResumesApi = {
  async upload(file, onProgress) {
    assertResumeAccess();
    onProgress?.(0);
    const now = new Date().toISOString();
    const resume = await cacheResume({
      id: makeMockId(),
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      extracted: structuredClone(mockExtraction),
      extractionStatus: 'completed',
      createdAt: now,
      updatedAt: now,
      isMock: true,
    });
    onProgress?.(100);
    return resume;
  },
  async list() {
    assertResumeAccess();
    return (await getAllRecords('resumes')).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  },
  async get(id) {
    assertResumeAccess();
    const resume = await getRecord('resumes', id);
    if (!resume) {
      const error = new Error('Resume not found.');
      error.status = 404;
      throw error;
    }
    return resume;
  },
  async remove(id) {
    assertResumeAccess();
    await deleteRecord('resumes', id);
    return { id };
  },
};

export const realResumesApi = {
  async upload(file, onProgress) {
    assertResumeAccess();
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress(event) {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
    onProgress?.(100);
    return cacheResume(resumeFrom(response));
  },
  async list() {
    assertResumeAccess();
    const response = await apiClient.get('/resumes');
    const resumes = itemsFrom(response);
    await Promise.all(resumes.map(cacheResume));
    return resumes;
  },
  async get(id) {
    assertResumeAccess();
    const response = await apiClient.get(`/resumes/${encodeURIComponent(id)}`);
    return cacheResume(resumeFrom(response));
  },
  async remove(id) {
    assertResumeAccess();
    await apiClient.delete(`/resumes/${encodeURIComponent(id)}`);
    await deleteRecord('resumes', id);
    return { id };
  },
};

function sourceApi() {
  return import.meta.env.VITE_USE_MOCK === 'true' ? mockResumesApi : realResumesApi;
}

export const resumesApi = {
  upload: (...args) => sourceApi().upload(...args),
  list: (...args) => sourceApi().list(...args),
  get: (...args) => sourceApi().get(...args),
  remove: (...args) => sourceApi().remove(...args),
};
