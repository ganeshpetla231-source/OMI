export const mockDashboardData = {
  stats: {
    totalInterviews: 8,
    averageScore: 82,
    practiceHours: 4.5,
    bestScore: 96,
    trends: { totalInterviews: '+2', averageScore: '+5%', practiceHours: '+1.5h', bestScore: '+3%' },
  },
  activity: [
    { id: 'activity-1', title: 'Frontend Developer', category: 'technical', totalScore: 88, completedAt: '2025-11-24T10:00:00.000Z' },
    { id: 'activity-2', title: 'Behavioral practice', category: 'hr', totalScore: 76, completedAt: '2025-11-22T10:00:00.000Z' },
  ],
  skills: { technical: 78, communication: 86, strongTopics: ['Problem solving', 'Communication'], weakTopics: ['System design'] },
  recommendations: [
    {
      id: 'recommendation-1',
      title: 'System design',
      reason: 'dashboard.recommendationReason',
      category: 'technical',
      jobRole: 'Software Engineer',
      difficulty: 'beginner',
      skill: 'System design',
    },
  ],
};

export const mockDashboardApi = {
  async getStats() {
    return mockDashboardData.stats;
  },
  async getActivity() {
    return mockDashboardData.activity;
  },
  async getSkills() {
    return mockDashboardData.skills;
  },
  async getRecommendations() {
    return mockDashboardData.recommendations;
  },
};
