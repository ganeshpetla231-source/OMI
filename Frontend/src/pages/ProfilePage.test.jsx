import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ToastProvider } from '../components/ui/Toast';
import { profileApi } from '../services/api/profileApi';
import { questionsApi } from '../services/api/questionsApi';
import ProfilePage from './ProfilePage';

vi.mock('../services/api/profileApi', () => ({
  profileApi: {
    get: vi.fn(),
    update: vi.fn(),
    updateSkills: vi.fn(),
  },
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: {
    getRoles: vi.fn(),
    getSkills: vi.fn(),
  },
}));

function renderProfile() {
  const router = createMemoryRouter([
    { path: '/profile', element: <ProfilePage /> },
    { path: '/dashboard', element: <h1>Dashboard</h1> },
  ], { initialEntries: ['/profile'] });
  render(
    <AuthContext.Provider value={{ updateCurrentUser: vi.fn() }}>
      <ToastProvider><LanguageProvider><RouterProvider router={router} /></LanguageProvider></ToastProvider>
    </AuthContext.Provider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    profileApi.get.mockResolvedValue({
      id: 'student-1',
      name: 'A Student',
      email: 'student@example.com',
      skills: Array.from({ length: 30 }, (_, index) => `Skill ${index + 1}`),
    });
    profileApi.update.mockImplementation(async (updates) => ({ id: 'student-1', ...updates }));
    profileApi.updateSkills.mockImplementation(async (skills) => ({ skills }));
    questionsApi.getRoles.mockResolvedValue({ items: ['Engineer'] });
    questionsApi.getSkills.mockResolvedValue({ items: ['JavaScript'] });
  });

  it('enforces the 30-skill limit and disables adding another skill', async () => {
    renderProfile();
    expect(await screen.findByText('30/30')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Add a skill'), { target: { value: 'Another skill' } });
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(profileApi.updateSkills).not.toHaveBeenCalled();
  });

  it('saves profile fields and skills through their API operations', async () => {
    profileApi.get.mockResolvedValue({
      id: 'student-1',
      name: 'A Student',
      email: 'student@example.com',
      skills: ['JavaScript'],
    });
    renderProfile();
    fireEvent.change(await screen.findByLabelText('Education'), { target: { value: 'Computer science' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(profileApi.update).toHaveBeenCalledWith(expect.objectContaining({ education: 'Computer science' }));
      expect(profileApi.updateSkills).toHaveBeenCalledWith(['JavaScript']);
    });
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });
});
