import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { resumesApi } from '../services/api/resumesApi';
import ResumePage from './ResumePage';

vi.mock('../services/api/resumesApi', () => ({
  resumesApi: {
    list: vi.fn(),
    get: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: { generate: vi.fn() },
}));

const extraction = {
  education: [{ degree: 'BSc', institution: 'Sample University' }],
  skills: ['JavaScript', 'React'],
  projects: [{ title: 'Portfolio', description: 'A sample project' }],
  experience: [{ title: 'Developer', organization: 'Sample Company' }],
};

function renderResume() {
  return render(
    <AuthContext.Provider value={{ user: { id: 'student-1' }, isAuthenticated: true, isGuest: false }}>
      <LanguageProvider>
        <MemoryRouter>
          <ResumePage />
        </MemoryRouter>
      </LanguageProvider>
    </AuthContext.Provider>,
  );
}

describe('ResumePage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.clearAllMocks();
  });

  it.each([
    ['pending', 'Extraction is in progress. This page will show the details when they are ready.'],
    ['completed', 'Resume details were extracted successfully.'],
    ['partial', 'Some details were extracted, but other sections were unclear. Try a clearer or text-based document.'],
    ['failed', 'The resume could not be processed. Check the file and upload it again.'],
    ['unsupported', 'This file format could not be processed. Upload a PDF, DOC, or DOCX file.'],
  ])('renders extracted sections and the %s extraction explanation', async (extractionStatus, explanation) => {
    const resume = {
      id: `resume-${extractionStatus}`,
      originalName: 'profile.pdf',
      sizeBytes: 1200,
      extractionStatus,
      extracted: extraction,
    };
    resumesApi.list.mockResolvedValue([resume]);
    resumesApi.get.mockResolvedValue(resume);
    renderResume();

    fireEvent.click(await screen.findByRole('button', { name: /profile\.pdf/ }));

    expect(await screen.findByText(explanation)).toBeInTheDocument();
    expect(screen.getByText('BSc — Sample University')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Portfolio — A sample project')).toBeInTheDocument();
    expect(screen.getByText('Developer — Sample Company')).toBeInTheDocument();
  });

  it('validates the selected file and shows upload progress', async () => {
    const uploaded = { id: 'resume-uploaded', originalName: 'profile.docx', sizeBytes: 800, extractionStatus: 'completed', extracted: extraction };
    resumesApi.list.mockResolvedValue([]);
    resumesApi.upload.mockImplementation(async (_file, onProgress) => {
      onProgress(48);
      onProgress(100);
      return uploaded;
    });
    renderResume();

    const input = await screen.findByLabelText('Choose file');
    fireEvent.change(input, { target: { files: [new File(['bad'], 'profile.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a PDF, DOC, or DOCX file.');

    fireEvent.change(input, { target: { files: [new File(['resume'], 'profile.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })] } });
    expect(await screen.findByRole('button', { name: /profile\.docx/ })).toBeInTheDocument();
    expect(resumesApi.upload).toHaveBeenCalledOnce();
  });
});
