import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStore, getAllRecords } from '../offline/db';
import { resumesApi } from './resumesApi';
import { MAX_RESUME_SIZE_BYTES, validateResumeFile } from '../../utils/resumeValidation';

describe('resume validation and API', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true');
    localStorage.clear();
    localStorage.setItem('talkready_token', 'resume-test-token');
    localStorage.removeItem('talkready_guest_mode');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await clearStore('resumes');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('validates supported extensions and the 5 MB limit', () => {
    expect(validateResumeFile({ name: 'profile.PDF', size: MAX_RESUME_SIZE_BYTES })).toEqual({ valid: true, reason: null });
    expect(validateResumeFile({ name: 'profile.txt', size: 20 })).toEqual({ valid: false, reason: 'type' });
    expect(validateResumeFile({ name: 'profile.docx', size: MAX_RESUME_SIZE_BYTES + 1 })).toEqual({ valid: false, reason: 'size' });
  });

  it('reports mock upload progress and saves extracted resume sections', async () => {
    const progress = vi.fn();
    const resume = await resumesApi.upload({ name: 'profile.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 512 }, progress);

    expect(progress.mock.calls).toEqual([[0], [100]]);
    expect(resume).toMatchObject({
      originalName: 'profile.docx',
      extractionStatus: 'completed',
      isMock: true,
      extracted: { skills: expect.arrayContaining(['JavaScript']) },
    });
    expect(await getAllRecords('resumes')).toEqual([expect.objectContaining({ id: resume.id })]);
  });

  it('blocks resume upload for guests and while offline', async () => {
    localStorage.setItem('talkready_guest_mode', 'true');
    await expect(resumesApi.upload({ name: 'profile.pdf', size: 10 })).rejects.toMatchObject({ code: 'RESUME_ACCOUNT_REQUIRED' });

    localStorage.removeItem('talkready_guest_mode');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await expect(resumesApi.upload({ name: 'profile.pdf', size: 10 })).rejects.toMatchObject({ code: 'RESUME_NETWORK_REQUIRED' });
  });
});
