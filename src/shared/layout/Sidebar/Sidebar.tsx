import { Boxes } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setActiveTab } from '@/shared/state/uiSlice';
import { useReconciledServices } from '@/shared/brew';
import { cn } from '@/shared/lib/cn';
import { NAV_ITEMS } from './Sidebar.config';

export const Sidebar = () => {
  const activeTab = useAppSelector((s) => s.ui.activeTab);
  const dispatch = useAppDispatch();
  const { services } = useReconciledServices();

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
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch(setActiveTab(tab))}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-fg-muted hover:bg-list hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{label}</span>
              {tab === 'services' && badge && (
                <span className="rounded-full bg-running-soft px-2 py-0.5 text-xs font-medium text-running tabular-nums">
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
