import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { adminApi } from '../services/api/adminApi';
import AdminDashboardPage from './AdminDashboardPage';

vi.mock('../services/api/adminApi', () => ({
  adminApi: { getDashboard: vi.fn() },
}));

function renderDashboard() {
  return render(
    <LanguageProvider>
      <MemoryRouter><AdminDashboardPage /></MemoryRouter>
    </LanguageProvider>,
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getDashboard.mockResolvedValue({
      usersCount: 12,
      interviewsCount: 30,
      questionsCount: 60,
      questionsByCategory: { technical: 20, hr: 10 },
      recentUsers: [{ id: 'user-1', name: 'Sample User', email: 'user@example.com', role: 'student' }],
      recentInterviews: [{ id: 'interview-1', jobRole: 'Software Engineer', category: 'technical', status: 'completed' }],
    });
  });

  it('renders usage cards, category bars, and recent activity from the API', async () => {
    renderDashboard();
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'technical: 20 questions' })).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Software Engineer')).toHaveLength(2);
  });
});
