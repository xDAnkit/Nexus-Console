import type { DoctorFinding } from '@/features/doctor/api/doctor.schema';

export interface FindingCardProps {
  finding: DoctorFinding;
  /** Nested findings (e.g. one row per ollama model) shown inside this
   * card when expanded, instead of as separate top-level rows. */
  subFindings?: DoctorFinding[];
}
