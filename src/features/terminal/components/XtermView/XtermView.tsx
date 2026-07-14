import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { openPty, writePty, resizePty, killPty, type PtyEvent } from '@/shared/tauri';
import { useResolvedTheme } from '@/shared/state/useResolvedTheme';
import { xtermTheme } from '@/features/terminal/utils/xtermTheme';
import type { TerminalSession } from '@/shared/state/terminalsSlice';

export const XtermView = ({ session, active }: { session: TerminalSession; active: boolean }) => {
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
  useEffect(() => {
    if (!active) return;
    const fit = fitRef.current;
    const term = termRef.current;
    if (!fit || !term) return;
    const onResize = () => {
      fit.fit();
      void resizePty(session.id, term.cols, term.rows);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, session.id]);

  // Re-theme on light/dark switch.
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = xtermTheme();
  }, [theme]);

  return <div ref={hostRef} className="selectable h-full w-full" />;
};
