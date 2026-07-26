import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Download, HardDrive, History, Stethoscope, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';
import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/lib/format';
import { ipc, CMD } from '@/shared/tauri';
import { JournalDialog } from '@/features/doctor/components/JournalDialog';
import { ScanHero } from '@/features/doctor/components/ScanHero';
import { buildReport } from '@/features/doctor/utils/report';
import { useDoctorScan } from '@/features/doctor/api/useDoctorScan';
import {
  DOCTOR_SCOPES,
  type DoctorFinding,
  type DoctorScope,
} from '@/features/doctor/api/doctor.schema';
import { FindingCard } from '@/features/doctor/components/FindingCard';

const SCOPE_LABELS: Record<DoctorScope, string> = {
  system: 'System',
  claude: 'Claude',
  vscode: 'VSCode',
  browser: 'Browser',
  disk: 'Disk',
  startup: 'Startup',
};

type ScopeTab = 'all' | DoctorScope;

const SEVERITY_RANK: Record<DoctorFinding['severity'], number> = { red: 0, yellow: 1, green: 2 };

// Probes that emit an overview + per-item rows (ollama models, VSCode
// extensions): the item rows nest INSIDE the overview card instead of
// flooding the top-level list. Overviews are recognized by their authored
// summary shape — ponytail: rename those summaries and this grouping breaks.
const OVERVIEW_PATTERNS: Record<string, RegExp> = {
  ollama_models: /^\d+ ollama models?\b/,
  extension_audit: /^\d+ extensions ·/,
  browser_extensions: /^\d+ extensions? ·/,
};
const isOverview = (f: DoctorFinding) => OVERVIEW_PATTERNS[f.probeId]?.test(f.summary) ?? false;
const isNestedChild = (f: DoctorFinding) => f.probeId in OVERVIEW_PATTERNS && !isOverview(f);

// Deep-scan progress messages, keyed by probe id (unknown ids fall back to a
// generic line, so a new probe never breaks the loader).
const PROBE_LABELS: Record<string, string> = {
  low_power_mode: 'Checking Low Power Mode…',
  memory_truth: 'Checking memory pressure…',
  backup_risk: 'Checking Time Machine…',
  startup_items: 'Checking startup items…',
  disk_free: 'Checking free disk space…',
  load_vs_cores: 'Checking CPU load…',
  ollama_models: 'Scanning ollama models…',
  vscode_orphans: 'Scanning VSCode workspace caches…',
  state_db_bloat: 'Checking VSCode databases…',
  extension_audit: 'Scanning VSCode extensions…',
  browser_processes: 'Scanning browsers…',
  browser_audio: 'Checking browser audio & background settings…',
  browser_storage: 'Measuring browser caches…',
  browser_extensions: 'Scanning browser extensions…',
  node_modules_sweep: 'Sweeping node_modules folders…',
  dev_caches: 'Measuring dev caches…',
};

export const DoctorPage = () => {
  const [tab, setTab] = useState<ScopeTab>('all');
  const [journalOpen, setJournalOpen] = useState(false);
  const {
    findings,
    scanning,
    deepScanning,
    hasScanned,
    error,
    progress,
    scan,
    deepScan,
    cancelScan,
    cancelDeepScan,
  } = useDoctorScan();
  const reduce = useReducedMotion();

  // Tabs are DERIVED from the report — a scope without findings gets no tab,
  // and the first run shows a single call-to-action instead of empty tabs.
  const availableTabs = useMemo(() => {
    const present = new Set(findings.map((f) => f.scope));
    return [
      { value: 'all' as ScopeTab, label: 'All' },
      ...DOCTOR_SCOPES.filter((s) => present.has(s)).map((s) => ({
        value: s as ScopeTab,
        label: SCOPE_LABELS[s],
      })),
    ];
  }, [findings]);
  const effectiveTab: ScopeTab = availableTabs.some((t) => t.value === tab) ? tab : 'all';

  // Tabs filter the report; Scan always runs everything.
  const displayed = useMemo(
    () =>
      findings
        .filter((f) => effectiveTab === 'all' || f.scope === effectiveTab)
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    [findings, effectiveTab],
  );

  const runScan = () => void scan([...DOCTOR_SCOPES]);
  const heroState = findings.length === 0 && !scanning && !deepScanning && !error;

  // Probes can emit several findings (per model, per browser) — the key must
  // be finding-unique, never just the probe id.
  const findingKey = (f: DoctorFinding) => `${f.probeId}·${f.summary}`;

  // a child with no overview present still renders standalone
  const rows = displayed.filter(
    (f) => !isNestedChild(f) || !displayed.some((x) => x.probeId === f.probeId && isOverview(x)),
  );
  const childrenOf = (f: DoctorFinding) =>
    displayed.filter((x) => x.probeId === f.probeId && !isOverview(x));

  // Browser tab: one section per browser (per-browser summaries start with the
  // browser name — ponytail: rename summaries and this grouping breaks), plus a
  // dedicated Extensions section whose overview nests the per-extension rows.
  // Built from `rows` so nested children never surface as top-level cards.
  const browserGroups = useMemo(() => {
    if (effectiveTab !== 'browser') return null;
    const order = ['Chrome', 'Brave', 'Edge', 'Extensions', 'Power & audio'];
    const groups = new Map<string, DoctorFinding[]>();
    for (const f of rows) {
      const g =
        f.probeId === 'browser_extensions'
          ? 'Extensions'
          : (['Chrome', 'Brave', 'Edge'].find((b) => f.summary.startsWith(b)) ?? 'Power & audio');
      const list = groups.get(g) ?? [];
      list.push(f);
      groups.set(g, list);
    }
    return order
      .filter((g) => groups.has(g))
      .map((g) => [g, groups.get(g) as DoctorFinding[]] as const);
  }, [rows, effectiveTab]);

  const attention = displayed.filter((f) => f.severity !== 'green').length;
  const subtitle = scanning
    ? 'Scanning…'
    : deepScanning
      ? 'Deep scanning — sweeping node_modules and dev caches…'
      : hasScanned
        ? `${attention} need${attention === 1 ? 's' : ''} attention · ${displayed.length - attention} healthy`
        : 'Read-only health check';

  // One key per visible state — changing it remounts the content wrapper so
  // every swap (start deep scan, cancel, scan complete) fades in instead of
  // hard-cutting. `scanning` outranks the findings check so a running quick
  // scan holds ONE loader (same as deep scan) instead of flickering as findings
  // stream in — the report appears once, when the scan resolves.
  const phase = error
    ? 'error'
    : deepScanning
      ? 'deep'
      : scanning
        ? 'scanning'
        : displayed.length > 0
          ? 'report'
          : hasScanned
            ? 'empty'
            : 'hero';

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">Doctor</h1>
          <p className="text-sm text-fg-muted tabular-nums">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="History"
            title="Every change the app has made"
            onClick={() => setJournalOpen(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Export report"
            title="Save a markdown report to the Desktop"
            disabled={findings.length === 0}
            onClick={() =>
              void ipc(
                CMD.DOCTOR_EXPORT,
                { content: buildReport(findings, formatTime(Date.now())) },
                z.string(),
              )
                .then((path) => toast.success('Report saved to Desktop', { description: path }))
                .catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : 'Export failed'),
                )
            }
          >
            <Download className="h-4 w-4" />
          </Button>
          {/* A running scan (quick or deep) collapses both actions into one
              Cancel — same as the deep scan already did, now for the quick scan
              too. Otherwise: Deep scan + Scan. */}
          {scanning || deepScanning ? (
            <Button variant="dangerOutline" onClick={deepScanning ? cancelDeepScan : cancelScan}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            !heroState && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void deepScan()}
                  title="Slow: the full scan plus node_modules and dev caches"
                >
                  <HardDrive className="h-4 w-4" />
                  Deep scan
                </Button>
                <Button onClick={runScan}>
                  <Stethoscope className="h-4 w-4" />
                  Scan
                </Button>
              </>
            )
          )}
        </div>
      </header>

      {/* Data-driven tab bar (MUI-style sliding indicator): tabs exist only
          for scopes that actually have findings — never a blank tab. Hidden
          during a deep scan too: the container is a single loader then, and
          half-built tabs above it would just flicker. */}
      {findings.length > 0 && !deepScanning && !scanning && (
        <nav className="relative flex border-b border-border px-6" aria-label="Report filter">
          {availableTabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={effectiveTab === value}
              onClick={() => setTab(value)}
              className={cn(
                'relative h-10 px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                effectiveTab === value
                  ? 'text-accent'
                  : 'text-fg-muted hover:bg-list hover:text-fg',
              )}
            >
              {label}
              {/* Shared-layout underline springs between tabs — no measuring. */}
              {effectiveTab === value && (
                <motion.span
                  aria-hidden
                  layoutId="doctor-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                  }
                />
              )}
            </button>
          ))}
        </nav>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-paper">
          <div key={phase} className="nx-enter flex min-h-0 flex-1 flex-col overflow-hidden">
            {error ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              </div>
            ) : deepScanning ? (
              // Deep scan replaces the report with one clear loading state:
              // what's being checked right now, how far along, and a way out.
              <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
                <Spinner className="h-8 w-8" />
                <div className="flex flex-col items-center gap-1 text-center">
                  <h3 className="text-sm font-semibold text-fg">Deep scanning…</h3>
                  <p className="text-sm text-fg-muted">
                    {progress
                      ? (PROBE_LABELS[progress.probeId] ?? 'Scanning…')
                      : 'Starting checks…'}
                  </p>
                </div>
                {/* Native <progress> (sr-only) carries the real a11y
                    semantics — the project's "real input underneath" pattern.
                    The visual fill springs between steps (motion, native feel);
                    the sheen keeps it alive while the value holds on a slow probe. */}
                <div className="relative h-1.5 w-72">
                  <progress
                    aria-label="Deep scan progress"
                    max={progress?.total ?? 1}
                    value={progress?.index ?? 0}
                    className="sr-only"
                  />
                  <div aria-hidden className="h-full overflow-hidden rounded-full bg-list">
                    <motion.div
                      className="relative h-full overflow-hidden rounded-full bg-accent"
                      initial={false}
                      animate={{
                        width: progress ? `${(progress.index / progress.total) * 100}%` : '0%',
                      }}
                      transition={
                        reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }
                      }
                    >
                      <span
                        aria-hidden
                        className="nx-progress-sheen absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
                      />
                    </motion.div>
                  </div>
                </div>
                <p className="text-xs text-fg-subtle tabular-nums">
                  {progress ? `Check ${progress.index + 1} of ${progress.total}` : ' '}
                </p>
                <Button variant="dangerOutline" onClick={cancelDeepScan}>
                  <X className="h-4 w-4" />
                  Cancel scan
                </Button>
              </div>
            ) : scanning ? (
              // Quick scan in progress: one calm loader covers the whole run
              // (findings stream in behind it) so the report reveals once,
              // instead of the list popping in and re-fading per probe. Same
              // layout + Cancel as the deep loader (no bar — no progress events).
              <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
                <Spinner className="h-8 w-8" />
                <div className="flex flex-col items-center gap-1 text-center">
                  <h3 className="text-sm font-semibold text-fg">Scanning…</h3>
                  <p className="text-sm text-fg-muted">Running read-only checks across your Mac.</p>
                </div>
                <Button variant="dangerOutline" onClick={cancelScan}>
                  <X className="h-4 w-4" />
                  Cancel scan
                </Button>
              </div>
            ) : displayed.length === 0 ? (
              hasScanned ? (
                <EmptyState
                  icon={<Stethoscope className="h-8 w-8" />}
                  title="Nothing to report"
                  description="The last scan produced no findings."
                />
              ) : (
                // First run: a proper hero that teaches what a scan covers —
                // never blank tabs.
                <ScanHero onScan={runScan} onDeepScan={() => void deepScan()} />
              )
            ) : (
              <div className="overflow-y-auto">
                {browserGroups
                  ? browserGroups.map(([group, items]) => (
                      <div key={group}>
                        <div className="border-b border-border bg-list px-4 py-2 text-xs font-semibold text-fg">
                          {group}
                        </div>
                        {items.map((f) => (
                          <FindingCard
                            key={findingKey(f)}
                            finding={f}
                            subFindings={isOverview(f) ? childrenOf(f) : undefined}
                          />
                        ))}
                      </div>
                    ))
                  : rows.map((f) => (
                      <FindingCard
                        key={findingKey(f)}
                        finding={f}
                        subFindings={isOverview(f) ? childrenOf(f) : undefined}
                      />
                    ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <JournalDialog open={journalOpen} onOpenChange={setJournalOpen} />
    </div>
  );
};
