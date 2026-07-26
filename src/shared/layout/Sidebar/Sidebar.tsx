import { Boxes } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setActiveTab } from '@/shared/state/uiSlice';
import { useReconciledServices } from '@/shared/brew';
import { cn } from '@/shared/lib/cn';
import { NAV_ITEMS } from './Sidebar.config';
import { useClaudeInstalled } from './useClaudeInstalled';

export const Sidebar = () => {
  const activeTab = useAppSelector((s) => s.ui.activeTab);
  const dispatch = useAppDispatch();
  const { services } = useReconciledServices();
  const claudeInstalled = useClaudeInstalled();
  const reduce = useReducedMotion();
  const navItems = NAV_ITEMS.filter((i) => i.tab !== 'archiver' || claudeInstalled);

  const running = services.filter((s) => s.status === 'running' || s.status === 'starting').length;
  const badge = services.length > 0 ? `${running}/${services.length}` : null;

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-paper p-4">
      {/* pt-8 clears the inset traffic lights (overlay titlebar); drag-region
          "deep" makes the logo/title draggable too — interactive children still
          work normally, only this element's own background + non-interactive
          children become drag handles. */}
      <div data-tauri-drag-region="deep" className="flex items-center gap-3 px-2 pt-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Boxes className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-fg">Nexus Console</p>
          <p className="text-xs text-fg-muted">Service Manager</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ tab, label, icon: Icon }) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch(setActiveTab(tab))}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'text-accent' : 'text-fg-muted hover:bg-list hover:text-fg',
              )}
            >
              {/* Shared-layout pill glides between items on selection. */}
              {isActive && (
                <motion.span
                  aria-hidden
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-accent-soft"
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
                  }
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10 flex-1 text-left">{label}</span>
              {tab === 'services' && badge && (
                <span className="relative z-10 rounded-full bg-running-soft px-2 py-0.5 text-xs font-medium text-running tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
