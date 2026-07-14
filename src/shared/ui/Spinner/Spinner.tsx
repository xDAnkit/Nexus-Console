import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('h-4 w-4 animate-spin text-fg-subtle', className)} aria-label="Loading" />
);
