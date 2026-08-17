import type { ModuleId } from '@/shared/modules';

export interface FeaturePickerProps {
  value: ModuleId[];
  /** Never called with an empty list — the picker refuses that inline. */
  onChange: (next: ModuleId[]) => void;
}
