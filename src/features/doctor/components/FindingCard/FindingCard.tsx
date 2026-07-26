import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRight, Wrench } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { IpcError } from '@/shared/tauri';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import { fixMeta, useDoctorFix } from '@/features/doctor/api/useDoctorFix';
import type { DoctorFinding } from '@/features/doctor/api/doctor.schema';
import type { FindingCardProps } from './FindingCard.types';

const DOT: Record<DoctorFinding['severity'], string> = {
  red: 'bg-danger-dot',
  yellow: 'bg-warn-dot',
  green: 'bg-running-dot',
};

const TAG_LABEL: Record<DoctorFinding['tag'], string> = {
  speed: 'Speed',
  storage: 'Storage',
  info: 'Info',
};

/** One report line: severity dot + one-line summary + honest tag.
 * Healthy (green) findings stay a single line; red/yellow expand into a
 * softly tinted panel with the explanation, guide steps, and — when the
 * finding is automatable — a Fix button whose result lands on the card. */
export const FindingCard = ({ finding, subFindings }: FindingCardProps) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fix = useDoctorFix();
  const reduce = useReducedMotion();
  const meta = fixMeta(finding.fix);
  // Green rows expand too when they carry an action, steps, or nested rows
  // (e.g. the "3 ollama models" overview expands into one row per model).
  const expandable =
    finding.severity !== 'green' ||
    meta != null ||
    (finding.guide?.length ?? 0) > 0 ||
    (subFindings?.length ?? 0) > 0;
  const destructive = meta != null && /^(Delete|Clear|Uninstall)/.test(meta.label);

  // Two-line rows: summaries are authored as "Title · meta · meta" — the
  // first segment is the title, the rest becomes the muted meta line.
  // ponytail: drop the " · " convention in a probe and its row goes one-line.
  const [title, ...metaParts] = finding.summary.split(' · ');
  const metaLine = metaParts.join(' · ');

  // Destructive fixes are confirm-gated by a NATIVE macOS dialog in Rust —
  // one click here, the system alert does the asking.
  const runFix = async () => {
    try {
      setResult(await fix.mutateAsync({ fixId: finding.fix as string }));
    } catch {
      /* fix.isError renders below (cancelled stays silent) */
    }
  };

  return (
    <div
      className={cn(
        'border-b border-border transition-colors last:border-b-0',
        open && 'bg-list/60',
      )}
    >
      <button
        type="button"
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
          expandable ? 'hover:bg-list' : 'cursor-default',
        )}
      >
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[finding.severity])} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{title}</span>
          {metaLine && (
            <span className="mt-0.5 block truncate text-xs text-fg-muted tabular-nums">
              {metaLine}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-fg-subtle">
          {TAG_LABEL[finding.tag]}
        </span>
        {/* Non-expandable rows keep an invisible chevron slot so the tag
            chips align down the whole list. */}
        {expandable ? (
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-[var(--duration-base)]',
              open && 'rotate-90',
            )}
          />
        ) : (
          <span aria-hidden className="h-4 w-4 shrink-0" />
        )}
      </button>
      {/* Real spring physics (measured height) = the macOS disclosure feel a
          CSS ease can't fake. AnimatePresence drives enter+exit; opacity is a
          fast tween so content is legible almost immediately. Reduced-motion
          collapses the transition to instant. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    height: { type: 'spring', stiffness: 500, damping: 40, mass: 1 },
                    opacity: { duration: 0.12 },
                  }
            }
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-3 px-4 pt-1 pb-4 pl-9">
              <p className="max-w-[70ch] text-sm leading-relaxed text-fg-muted">
                {finding.explain}
              </p>
              {subFindings && subFindings.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-border bg-canvas">
                  {subFindings.map((sf) => (
                    <FindingCard key={`${sf.probeId}·${sf.summary}`} finding={sf} />
                  ))}
                </div>
              )}
              {finding.guide && finding.guide.length > 0 && (
                <ol className="max-w-[70ch] list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg-muted">
                  {finding.guide.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              {meta &&
                (result ? (
                  <p className="text-sm font-medium text-running">
                    ✓ {result} — run Scan again to refresh.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={destructive ? 'dangerOutline' : 'primary'}
                      disabled={fix.isPending}
                      onClick={() => void runFix()}
                    >
                      {fix.isPending ? (
                        <Spinner className="text-current" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                      {meta.label}
                    </Button>
                    {fix.isError &&
                      !(fix.error instanceof IpcError && fix.error.kind === 'cancelled') && (
                        <span className="text-sm text-danger">
                          {fix.error instanceof Error ? fix.error.message : 'Fix failed'}
                        </span>
                      )}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
