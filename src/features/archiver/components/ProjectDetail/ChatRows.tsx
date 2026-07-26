import { useState, type ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { formatRelative, formatTime } from '@/shared/lib/format';
import type { Chat } from '@/features/archiver/api/archiver.schema';

/** Chats render in pages of this size — "Show more" appends the next page. */
const PAGE = 50;

export interface RowAction {
  label: string;
  icon: ReactNode;
  /** Renders red — permanent deletes. */
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onAct: (file: string) => void;
}

interface ChatRowsProps {
  chats: Chat[];
  selected: Set<string>;
  onToggle: (file: string) => void;
  /** Per-row actions, surfaced in a three-dots menu (Archive/Delete, etc.). */
  actions: RowAction[];
}

const itemCls =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-list data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

const RowMenu = ({ actions, file }: { actions: RowAction[]; file: string }) => (
  <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        aria-label="Chat actions"
        className="shrink-0 rounded-md p-1.5 text-fg-muted transition-colors hover:bg-list hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={4}
        className="nx-pop z-[var(--z-dropdown)] min-w-40 rounded-lg border border-border bg-paper p-1 shadow-md"
      >
        {actions.map((a) => (
          <DropdownMenu.Item
            key={a.label}
            disabled={a.disabled}
            title={a.title}
            className={cn(itemCls, a.danger ? 'text-danger' : 'text-fg')}
            onSelect={() => a.onAct(file)}
          >
            {a.icon}
            {a.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

/** One checkbox-selectable chat list with lightweight pagination — shared by
 * the Live and Archived sections so both read identically. Rows are two-line
 * (title over relative time), matching the ollama finding rows. */
export const ChatRows = ({ chats, selected, onToggle, actions }: ChatRowsProps) => {
  const [visible, setVisible] = useState(PAGE);
  const shown = chats.slice(0, visible);

  return (
    <>
      <ul className="divide-y divide-border">
        {shown.map((chat) => (
          <li key={chat.file} className="flex items-center gap-3 px-4 py-2.5">
            <Checkbox
              checked={selected.has(chat.file)}
              onChange={() => onToggle(chat.file)}
              ariaLabel={`Select ${chat.title}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg">{chat.title}</span>
              <span
                className="mt-0.5 block text-xs text-fg-subtle tabular-nums"
                title={formatTime(chat.epoch * 1000)}
              >
                {formatRelative(chat.epoch * 1000)}
              </span>
            </span>
            <RowMenu actions={actions} file={chat.file} />
          </li>
        ))}
      </ul>
      {chats.length > visible && (
        <div className="border-t border-border p-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show {Math.min(PAGE, chats.length - visible)} more ({chats.length - visible} remaining)
          </Button>
        </div>
      )}
    </>
  );
};
