import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { dashboardApi } from '../services/api/dashboardApi';
import DashboardPage from './DashboardPage';

vi.mock('../services/api/dashboardApi', () => ({
  dashboardApi: {
    getStats: vi.fn(),
    getActivity: vi.fn(),
    getSkills: vi.fn(),
    getRecommendations: vi.fn(),
  },
}));

function LocationState() {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify(location.state)}</output>;
}

function renderDashboard({ guest = false } = {}) {
  return render(
    <AuthContext.Provider value={{ user: { name: 'Taylor' }, isGuest: guest }}>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/interview/setup" element={<LocationState />} />
            <Route path="/questions" element={<h1>Question bank destination</h1>} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </AuthContext.Provider>,
  );
}

function resolveResources({
  stats = { totalInterviews: 8, averageScore: 82, practiceHours: 4.5, bestScore: 96 },
  activity = [{ id: 'one', title: 'Frontend Developer', totalScore: 88 }],
  skills = { technical: 78, communication: 86, strongTopics: ['Communication'], weakTopics: ['System design'] },
  recommendations = [{
    id: 'one',
    title: 'System design',
    category: 'technical',
    jobRole: 'Software Engineer',
    difficulty: 'beginner',
    skill: 'System design',
  }],
} = {}) {
  dashboardApi.getStats.mockResolvedValue(stats);
  dashboardApi.getActivity.mockResolvedValue(activity);
  dashboardApi.getSkills.mockResolvedValue(skills);
  dashboardApi.getRecommendations.mockResolvedValue(recommendations);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resolveResources();
  });

  it('shows loading skeletons while each resource is pending', () => {
    dashboardApi.getStats.mockReturnValue(new Promise(() => {}));
    dashboardApi.getActivity.mockReturnValue(new Promise(() => {}));
    dashboardApi.getSkills.mockReturnValue(new Promise(() => {}));
    dashboardApi.getRecommendations.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByLabelText('Interview statistics')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading recent activity')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading skill performance')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading recommendations')).toBeInTheDocument();
  });

  it('shows friendly empty states and a first-interview call to action', async () => {
    resolveResources({
      stats: { totalInterviews: 0, averageScore: 0, practiceHours: 0, bestScore: 0 },
      activity: [],
      skills: { technical: 0, communication: 0, strongTopics: [], weakTopics: [] },
      recommendations: [],
    });

    renderDashboard({ guest: true });

    expect(await screen.findByText('Your interview journey starts here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start your first interview' })).toBeInTheDocument();
    expect(screen.getByText('No recent activity yet')).toBeInTheDocument();
    expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });

  it('renders mock-style data and forwards recommendation selections in router state', async () => {
    renderDashboard();

    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getAllByText('System design')).not.toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Practice now' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-state')).toHaveTextContent(JSON.stringify({
        category: 'technical',
        jobRole: 'Software Engineer',
        role: 'Software Engineer',
        difficulty: 'beginner',
        skill: 'System design',
        skills: ['System design'],
      }));
    });
  });

  it('shows a quick action that navigates to the implemented question bank', async () => {
    renderDashboard();

    const questionsLink = await screen.findByRole('link', { name: 'Practice questions' });
    fireEvent.click(questionsLink);

    expect(await screen.findByRole('heading', { name: 'Question bank destination' })).toBeInTheDocument();
  });

  it('keeps other dashboard resources usable and retries only the failed resource', async () => {
    dashboardApi.getStats
      .mockRejectedValueOnce(new Error('Stats are temporarily unavailable.'))
      .mockResolvedValueOnce({ totalInterviews: 3, averageScore: 70, practiceHours: 1, bestScore: 80 });

    renderDashboard();

    expect(await screen.findByText('Stats are temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Skill performance')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);

    await waitFor(() => expect(dashboardApi.getStats).toHaveBeenCalledTimes(2));
    expect(dashboardApi.getActivity).toHaveBeenCalledTimes(1);
    expect(dashboardApi.getSkills).toHaveBeenCalledTimes(1);
    expect(dashboardApi.getRecommendations).toHaveBeenCalledTimes(1);
  });
});
