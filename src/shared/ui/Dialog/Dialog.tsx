import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { DialogProps } from './Dialog.types';

export const Dialog = ({ open, onOpenChange, title, description, children }: DialogProps) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="nx-fade fixed inset-0 z-[var(--z-backdrop)] bg-black/40" />
      <RadixDialog.Content className="nx-dialog fixed inset-x-0 top-[12vh] z-[var(--z-modal)] mx-auto flex max-h-[76vh] w-[min(32rem,92vw)] flex-col rounded-xl border border-border bg-paper p-5 focus:outline-none">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RadixDialog.Title className="text-base font-semibold text-fg">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-0.5 text-xs text-fg-muted">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Close"
            className="rounded-md p-1 text-fg-muted hover:bg-list hover:text-fg"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);
