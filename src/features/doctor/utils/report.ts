import type { DoctorFinding } from '@/features/doctor/api/doctor.schema';

const TAG_LABEL = { speed: 'Speed', storage: 'Storage', info: 'Info' } as const;
const RANK = { red: 0, yellow: 1, green: 2 } as const;

/** Markdown report of the current findings — what Doctor found (and honest tags). */
export function buildReport(findings: DoctorFinding[], dateLabel: string): string {
  const sorted = [...findings].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  const attention = sorted.filter((f) => f.severity !== 'green');
  const healthy = sorted.filter((f) => f.severity === 'green');
  return [
    `# Nexus Doctor report — ${dateLabel}`,
    '',
    `## Needs attention (${attention.length})`,
    ...(attention.length
      ? attention.map((f) => `- **[${TAG_LABEL[f.tag]}]** ${f.summary}\n  ${f.explain}`)
      : ['- Nothing — all clear.']),
    '',
    `## Healthy (${healthy.length})`,
    ...healthy.map((f) => `- **[${TAG_LABEL[f.tag]}]** ${f.summary}`),
    '',
  ].join('\n');
}
