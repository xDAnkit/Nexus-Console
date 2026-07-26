import { useState } from 'react';
import { FolderOpen, Settings2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';
import { useArchivedChats, useClaudeProjects } from '@/features/archiver/api/useArchiver';
import { ArchiveSettingsDialog } from '@/features/archiver/components/ArchiveSettingsDialog';
import { ProjectDetail, type ArchiverRow } from '@/features/archiver/components/ProjectDetail';

const ListSkeleton = () => (
  <div aria-hidden>
    {Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="border-b border-border px-4 py-3 last:border-b-0">
        <div className="h-4 w-36 animate-pulse rounded bg-list" />
        <div className="mt-1.5 h-3 w-52 animate-pulse rounded bg-list" />
      </div>
    ))}
  </div>
);

/** Master-detail: projects on the left, the selected project's chats +
 * actions on the right (macOS Notes/Mail pattern). */
export const ArchiverPage = () => {
  const projects = useClaudeProjects();
  const archived = useArchivedChats();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isPending = projects.isPending || archived.isPending;

  // Live projects first (already newest-activity-first), then orphan archive
  // folders whose original project no longer exists.
  const rows: ArchiverRow[] = [
    ...(projects.data ?? []).map((p) => ({
      id: p.dirName,
      displayName: p.displayName,
      subtitle: p.realPath ?? 'original folder not found',
      live: p,
      archived: (archived.data ?? []).find((a) => a.dirName === p.dirName) ?? null,
    })),
    ...(archived.data ?? [])
      .filter((a) => a.dirName == null)
      .map((a) => ({
        id: `orphan:${a.folder}`,
        displayName: a.folder,
        subtitle: 'archive only — original project removed',
        live: null,
        archived: a,
      })),
  ]
    // Hide empty projects — 0 live AND 0 archived is just noise, not a project.
    .filter((r) => (r.live?.sessions ?? 0) + (r.archived?.chats.length ?? 0) > 0);
  const active = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const totalChats = rows.reduce((n, r) => n + (r.live?.sessions ?? 0), 0);
  const archiveBytes = (archived.data ?? []).reduce((n, p) => n + p.totalBytes, 0);
  const subtitle = isPending
    ? 'Claude chat archive'
    : `${rows.length} projects · ${totalChats} live chats · ${formatBytes(archiveBytes)} archived`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Claude Chats</h1>
          <p className="text-sm text-fg-muted tabular-nums">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Archive settings"
          title="Archive settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-4 p-6">
        {/* Master: projects */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-paper">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-fg">
            Projects
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isPending ? (
              <ListSkeleton />
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-fg-muted">Nothing in ~/.claude/projects.</p>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={active?.id === r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'block w-full border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                    active?.id === r.id ? 'bg-accent-soft' : 'hover:bg-list',
                  )}
                >
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      active?.id === r.id ? 'text-accent' : 'text-fg',
                    )}
                  >
                    {r.displayName}
                  </span>
                  <span className="block truncate text-xs text-fg-subtle">{r.subtitle}</span>
                  <span className="block text-xs text-fg-muted tabular-nums">
                    {r.live?.sessions ?? 0} live · {r.archived?.chats.length ?? 0} archived
                    {r.live?.cacheBytes != null && ` · ${formatBytes(r.live.cacheBytes)} cache`}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Detail: selected project's chats + actions */}
        {isPending ? (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-paper">
            <div aria-hidden className="p-4">
              <div className="h-4 w-48 animate-pulse rounded bg-list" />
              <div className="mt-2 h-3 w-72 animate-pulse rounded bg-list" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-list" />
                ))}
              </div>
            </div>
          </section>
        ) : active ? (
          <ProjectDetail key={active.id} row={active} />
        ) : (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-paper">
            <EmptyState
              icon={<FolderOpen className="h-8 w-8" />}
              title="No Claude projects"
              description="Nothing found in ~/.claude/projects on this machine."
            />
          </section>
        )}
      </div>

      <ArchiveSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
