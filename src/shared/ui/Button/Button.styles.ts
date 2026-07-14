import { cva, type VariantProps } from 'class-variance-authority';

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        primaryOutline: 'border border-accent text-accent hover:bg-accent-soft',
        secondary: 'border border-border bg-paper text-fg hover:bg-list',
        ghost: 'text-fg-muted hover:bg-list hover:text-fg',
        dangerGhost: 'text-fg-muted hover:bg-danger-soft hover:text-danger',
        dangerOutline: 'border border-danger text-danger hover:bg-danger-soft',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonStyles>;
