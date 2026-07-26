import { Play, Square, Link2, Unlink, Download, TerminalSquare, ScrollText } from 'lucide-react';
import { useAppDispatch } from '@/shared/state/hooks';
import { setIntent } from '@/shared/state/serviceIntentSlice';
import { openTerminal } from '@/shared/state/terminalsSlice';
import { markUserStop } from '@/shared/lib/userStops';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner/Spinner';
import { useSetLinkIntent, useInstallFormula } from '@/shared/brew';
import { useServiceControls } from '@/features/services/useServiceControls';
import { powerState } from './powerState';
import type { ServiceActionsProps } from './ServiceActions.types';

export const ServiceActions = ({ service, compact = false }: ServiceActionsProps) => {
  const dispatch = useAppDispatch();
  const { startMut, stopMut, start, stop } = useServiceControls();
  const relink = useSetLinkIntent();
  const install = useInstallFormula();

  const linked = service.linkState === 'linked';
  const isRunning = service.status === 'running' || service.status === 'starting';
  // Button state derives from the REAL service status (+ the in-flight mutation),
  // so the loader tracks the actual start/stop transition, not a guess. See
  // powerState.ts.
  const power = powerState(service.status, startMut.isPending, stopMut.isPending);
  // Other actions lock while any brew op runs or the service is mid-transition.
  const busy = power.loading || relink.isPending || install.isPending;

  if (service.status === 'notInstalled') {
    return (
      <Button size="sm" disabled={busy} onClick={() => install.mutate({ name: service.formula })}>
        <Download className="h-4 w-4" />
        Install
      </Button>
    );
  }

  const toggleLink = () => {
    const next = linked ? 'unlinked' : 'linked';
    dispatch(setIntent({ formula: service.formula, linkState: next }));
    if (isRunning) {
      markUserStop(service.formula); // relink stops+starts — not a crash
      relink.mutate({ name: service.formula, linked: !linked });
    }
  };

  // Intent + user-stop bookkeeping live in useServiceControls (shared with bulk).
  // Errors surface via the global toast; catch just avoids an unhandled rejection.
  const handleStart = () => void start(service).catch(() => {});
  const handleStop = () => void stop(service).catch(() => {});

  const openCli = () =>
    dispatch(openTerminal({ formula: service.formula, title: service.displayName, kind: 'cli' }));
  const openLogs = () =>
    dispatch(
      openTerminal({
        formula: service.formula,
        title: `${service.displayName} · logs`,
        kind: 'logs',
      }),
    );

  const powerAction =
    power.face === 'stop'
      ? {
          key: 'stop',
          label: 'Stop',
          Icon: Square,
          onClick: handleStop,
          variant: 'dangerOutline' as const,
          disabled: power.disabled || relink.isPending || install.isPending,
          loading: power.loading,
        }
      : {
          key: 'start',
          label: 'Start',
          Icon: Play,
          onClick: handleStart,
          variant: 'primaryOutline' as const,
          disabled: power.disabled || relink.isPending || install.isPending,
          loading: power.loading,
        };

  const actions = [
    powerAction,
    {
      key: 'link',
      label: linked ? 'Unlink' : 'Link',
      Icon: linked ? Unlink : Link2,
      onClick: toggleLink,
      variant: 'secondary' as const,
      disabled: busy,
      loading: false,
    },
    {
      key: 'cli',
      label: 'CLI',
      Icon: TerminalSquare,
      onClick: openCli,
      variant: 'secondary' as const,
      disabled: false,
      loading: false,
    },
    {
      key: 'logs',
      label: 'Logs',
      Icon: ScrollText,
      onClick: openLogs,
      variant: 'ghost' as const,
      disabled: false,
      loading: false,
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-nowrap items-center gap-1">
        {actions.map(({ key, label, Icon, onClick, variant, disabled, loading }) => (
          <Button
            key={key}
            variant={variant}
            size="icon"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            title={label}
          >
            {loading ? <Spinner className="h-4 w-4 text-current" /> : <Icon className="h-4 w-4" />}
          </Button>
        ))}
      </div>
    );
  }

  return (
    // Equal-width buttons fill the footer in one clean row. No `min-w-0`/`truncate`,
    // so flex-1 never shrinks a button below its label — no more "St…"/"Lo…".
    // The grid's min card width (ServiceGrid) guarantees all four fit.
    <div className="flex items-center gap-1.5">
      {actions.map(({ key, label, Icon, onClick, variant, disabled, loading }) => (
        <Button
          key={key}
          variant={variant}
          size="sm"
          disabled={disabled}
          onClick={onClick}
          className="flex-1 gap-1.5 px-2"
        >
          {loading ? (
            <Spinner className="h-3.5 w-3.5 shrink-0 text-current" />
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
};
