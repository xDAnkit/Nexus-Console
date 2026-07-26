import { cva } from 'class-variance-authority';

export const chipStyles = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        running: 'bg-running-soft text-running',
        starting: 'bg-warn-soft text-warn',
        stopping: 'bg-warn-soft text-warn',
        stopped: 'bg-stopped-soft text-stopped',
        notInstalled: 'bg-warn-soft text-warn',
        error: 'bg-danger-soft text-danger',
      },
    },
    defaultVariants: { status: 'stopped' },
  },
);

export const dotStyles = cva('h-1.5 w-1.5 rounded-full', {
  variants: {
    status: {
      running: 'bg-running-dot',
      starting: 'bg-warn-dot animate-pulse',
      stopping: 'bg-warn-dot animate-pulse',
      stopped: 'bg-stopped-dot',
      notInstalled: 'bg-warn-dot',
      error: 'bg-danger-dot',
    },
  },
  defaultVariants: { status: 'stopped' },
});
