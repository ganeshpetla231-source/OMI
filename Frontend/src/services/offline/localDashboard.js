import { listLocalReports } from './localInterviewStore';
import { listLocalInterviews } from './localInterviews';

async function completedInterviews() {
  const result = await listLocalInterviews({ page: 1, limit: 10000 });
  return result.items.filter((interview) => interview.status === 'completed');
}

function getScore(interview, report) {
  const score = Number(interview.totalScore ?? report?.scores?.total ?? interview.score);
  return Number.isFinite(score) ? score : null;
}

function getDurationHours(interview) {
  const minutes = Number(interview.durationMinutes ?? interview.duration);
  if (Number.isFinite(minutes) && minutes > 0) return minutes / 60;
  const seconds = Number(interview.elapsedSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds / 3600 : 0;
}

function buildSkillSummary(interviews, reports) {
  const reportByInterview = new Map(reports.map((report) => [report.interviewId, report]));
  const topicScores = new Map();
  let technicalTotal = 0;
  let technicalCount = 0;
  let communicationTotal = 0;
  let communicationCount = 0;

  for (const interview of interviews) {
    const report = reportByInterview.get(interview.id);
    const communication = Number(interview.communicationScore ?? report?.scores?.communication);
    if (Number.isFinite(communication)) {
      communicationTotal += communication;
      communicationCount += 1;
    }
    if (['technical', 'coding'].includes(interview.category)) {
      const score = getScore(interview, report);
      if (score !== null) {
        technicalTotal += score;
        technicalCount += 1;
      }
    }
    for (const result of report?.questionResults || []) {
      if (!result.skill || !Number.isFinite(Number(result.evaluation?.score))) continue;
      const scores = topicScores.get(result.skill) || [];
      scores.push(Number(result.evaluation.score));
      topicScores.set(result.skill, scores);
    }
  }

  const topics = [...topicScores.entries()]
    .map(([name, scores]) => ({ name, score: scores.reduce((sum, score) => sum + score, 0) / scores.length }))
    .sort((left, right) => right.score - left.score);
  return {
    technical: technicalCount ? technicalTotal / technicalCount : 0,
    communication: communicationCount ? communicationTotal / communicationCount : 0,
    strongTopics: topics.filter((topic) => topic.score >= 70).slice(0, 3).map((topic) => topic.name),
    weakTopics: [...topics].reverse().filter((topic) => topic.score < 70).slice(0, 3).map((topic) => topic.name),
  };
}

export const localDashboardApi = {
  async getStats() {
    const interviews = await completedInterviews();
    const reports = await listLocalReports();
    const reportByInterview = new Map(reports.map((report) => [report.interviewId, report]));
    const scores = interviews.map((interview) => getScore(interview, reportByInterview.get(interview.id))).filter((score) => score !== null);
    return {
      totalInterviews: interviews.length,
      averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      practiceHours: interviews.reduce((sum, interview) => sum + getDurationHours(interview), 0),
      bestScore: scores.length ? Math.max(...scores) : 0,
    };
  },

  async getActivity() {
    return (await completedInterviews())
      .sort((left, right) => new Date(right.completedAt || right.updatedAt || right.createdAt) - new Date(left.completedAt || left.updatedAt || left.createdAt))
      .slice(0, 5);
  },

  async getSkills() {
    return buildSkillSummary(await completedInterviews(), await listLocalReports());
  },

  async getRecommendations() {
    const skills = await this.getSkills();
    if (!skills.weakTopics.length) return [];
    return [{
      id: `skill-${skills.weakTopics[0]}`,
      title: skills.weakTopics[0],
      reason: 'dashboard.recommendationReason',
      category: 'technical',
      jobRole: '',
      difficulty: 'beginner',
      skill: skills.weakTopics[0],
    }];
  },
};
