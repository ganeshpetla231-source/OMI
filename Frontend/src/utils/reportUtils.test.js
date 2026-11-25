import { describe, expect, it } from 'vitest';
import { buildReportsCsv, reportScore, reportFilename, scoreTone } from './reportUtils';

describe('report utilities', () => {
  it('uses explicit and accessible score ranges', () => {
    expect(scoreTone(39)).toBe('danger');
    expect(scoreTone(40)).toBe('warning');
    expect(scoreTone(69)).toBe('warning');
    expect(scoreTone(70)).toBe('success');
    expect(reportScore({ scores: { total: 105 } })).toBe(100);
    expect(reportScore({ scores: { content: 62 } }, 'content')).toBe(62);
  });

  it('exports report rows as escaped CSV with all required score columns', () => {
    const csv = buildReportsCsv([{
      title: 'Interview, round "one"',
      category: 'technical',
      createdAt: '2026-11-25',
      scores: { total: 82, content: 78, communication: 91 },
    }]);

    expect(csv).toBe([
      'Date,Title,Category,Total,Content,Communication',
      '2026-11-25,"Interview, round ""one""",technical,82,78,91',
    ].join('\r\n'));
  });

  it('creates a safe printable PDF filename', () => {
    expect(reportFilename({ title: 'Interview: Senior Engineer / Round 2' })).toBe('Interview-Senior-Engineer-Round-2.pdf');
  });
});
