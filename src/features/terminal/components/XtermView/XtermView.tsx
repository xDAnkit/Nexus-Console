import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { openPty, writePty, resizePty, killPty, type PtyEvent } from '@/shared/tauri';
import { useResolvedTheme } from '@/shared/state/useResolvedTheme';
import { xtermTheme } from '@/features/terminal/utils/xtermTheme';
import type { TerminalSession } from '@/shared/state/terminalsSlice';

export const XtermView = ({
  session,
  active,
  visible = true,
}: {
  session: TerminalSession;
  active: boolean;
  /** Drawer visibility — fit() no-ops on a display:none container, so a refit
   * must run when the drawer reshows. */
  visible?: boolean;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const theme = useResolvedTheme();

  // Create the terminal + PTY once per session; kill the PTY on unmount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      scrollback: 5000,
      cursorBlink: true,
      theme: xtermTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const dataSub = term.onData((d) => void writePty(session.id, d));
    void openPty(
      {
        id: session.id,
        formula: session.formula,
        kind: session.kind,
        cols: term.cols,
        rows: term.rows,
      },
      (e: PtyEvent) => {
        if (e.type === 'output') term.write(e.data);
        else term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
      },
    );

    return () => {
      dataSub.dispose();
      void killPty(session.id);
      term.dispose();
    };
  }, [session.id, session.formula, session.kind]);

  // Fit + tell the PTY the new size whenever this terminal is shown or resized.
  // rAF-coalesced (live window drags fire many resize events per frame) and the
  // IPC is skipped when cols/rows didn't actually change.
  useEffect(() => {
    if (!active || !visible) return;
    const fit = fitRef.current;
    const term = termRef.current;
    if (!fit || !term) return;
    let prevCols = 0;
    let prevRows = 0;
    let raf = 0;
    const doFit = () => {
      fit.fit();
      if (term.cols !== prevCols || term.rows !== prevRows) {
        prevCols = term.cols;
        prevRows = term.rows;
        void resizePty(session.id, term.cols, term.rows);
      }
    };
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        doFit();
      });
    };
    doFit();
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [active, visible, session.id]);

  // Re-theme on light/dark switch.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = xtermTheme();
  }, [theme]);

  return <div ref={hostRef} className="selectable h-full w-full" />;
};
