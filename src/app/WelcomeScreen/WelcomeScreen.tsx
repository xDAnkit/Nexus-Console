import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ALL_MODULES,
  MODULES,
  availableModules,
  useClaudeInstalled,
  visibleTabs,
  type ModuleId,
} from '@/shared/modules';
import { useAppDispatch } from '@/shared/state/hooks';
import { setEnabledModules } from '@/shared/state/settingsSlice';
import { setActiveTab } from '@/shared/state/uiSlice';
import { Button } from '@/shared/ui/Button';
// Deep import, not the feature barrel: the barrel pulls SettingsPage (and with it
// the whole settings graph) into this screen's chunk.
import { FeaturePicker } from '@/features/settings/components/FeaturePicker';
import { PRESETS } from './WelcomeScreen.config';

/** First launch only (`settings.enabledModules === null`). One screen, one
 * question, skippable in a single keystroke — deliberately not a wizard.
 *
 * Starts with everything the machine supports switched ON, so doing nothing gives
 * the full app; the screen is about opting OUT of what you won't use. */
export const WelcomeScreen = () => {
  const dispatch = useAppDispatch();
  const claudeInstalled = useClaudeInstalled();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<ModuleId[]>(() =>
    availableModules(ALL_MODULES, { claudeInstalled }),
  );

  const confirm = () => {
    dispatch(setEnabledModules(selected));
    // Land on something that exists — Services may not be in the selection.
    dispatch(setActiveTab(visibleTabs(selected)[0]));
  };

  // Plain digits toggle, Enter continues. No modifier, so this can't collide with
  // the app's Cmd+N shortcuts (which aren't mounted yet anyway).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        confirm();
        return;
      }
      const nth = Number(e.key);
      if (!Number.isInteger(nth) || nth < 1 || nth > MODULES.length) return;
      const id = MODULES[nth - 1].id;
      if (!availableModules([id], { claudeInstalled }).length) return;
      setSelected((prev) => {
        const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
        return next.length > 0 ? next : prev; // last one can't go
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 4 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.18, delay, ease: [0.2, 0, 0, 1] as const },
        };

  return (
    <div className="flex h-screen w-screen flex-col overflow-auto bg-canvas text-fg">
      <div data-tauri-drag-region className="h-7 w-full shrink-0" />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-8 py-10">
        <motion.header {...rise(0)} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Boxes className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-fg-muted">Nexus Console</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Choose what you&rsquo;ll use
          </h1>
          <p className="max-w-prose text-sm text-fg-muted">
            Nexus only runs the parts you switch on. Change this any time in Settings — nothing is
            deleted.
          </p>
        </motion.header>

        <motion.div {...rise(0.06)} className="flex flex-wrap gap-2">
          {PRESETS.filter((p) => availableModules(p.modules, { claudeInstalled }).length > 0).map(
            (p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelected(availableModules(p.modules, { claudeInstalled }))}
                className="rounded-md border border-border bg-paper px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-list hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {p.label}
              </button>
            ),
          )}
        </motion.div>

        <motion.div {...rise(0.12)} className="flex flex-col gap-2">
          <FeaturePicker value={selected} onChange={setSelected} />
        </motion.div>

        <motion.footer {...rise(0.18)} className="flex items-center justify-between gap-4">
          <p className="text-xs text-fg-subtle">
            {MODULES.length > 0 && `1–${MODULES.length} to toggle · Enter to continue`}
          </p>
          <Button onClick={confirm}>Continue</Button>
        </motion.footer>
      </div>
    </div>
  );
};
