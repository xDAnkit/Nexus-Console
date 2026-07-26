import type { ArchivedProject, ClaudeProject } from '@/features/archiver/api/archiver.schema';

/** One row of the master list: a live project, an orphan archive folder, or both. */
export interface ArchiverRow {
  id: string;
  displayName: string;
  subtitle: string;
  live: ClaudeProject | null;
  archived: ArchivedProject | null;
}

export interface ProjectDetailProps {
  row: ArchiverRow;
}
