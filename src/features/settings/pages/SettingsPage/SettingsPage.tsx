import { useAppDispatch, useAppSelector } from '@/shared/state/hooks';
import { setTheme, setLayout, setEnabledModules } from '@/shared/state/settingsSlice';
import { useEnabledModules } from '@/shared/modules';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { FeaturePicker } from '@/features/settings/components/FeaturePicker';
import { HomebrewStatusCard } from '@/features/settings/components/HomebrewStatusCard';
import { ManagedServicesEditor } from '@/features/settings/components/ManagedServicesEditor';
import { THEME_OPTIONS, LAYOUT_OPTIONS } from './SettingsPage.config';

export const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.settings.theme);
  const layout = useAppSelector((s) => s.settings.layout);
  const enabledModules = useEnabledModules();

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-fg">Settings</h1>
        <p className="text-sm text-fg-muted">Features, theme, Homebrew &amp; managed services</p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* Bento: two paired panels up top, managed services spanning full width below —
            fills the window without stretching any single control row. */}
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 items-start gap-4 p-6 xl:grid-cols-2 xl:gap-6 xl:p-8">
          {/* First: it decides what the rest of the app even shows. Spans both
              columns so the four cards read as one set. */}
          <section className="rounded-xl border border-border bg-paper p-5 xl:col-span-2">
            <h2 className="text-base font-semibold text-fg">Features</h2>
            <p className="mt-1 mb-4 text-xs text-fg-muted">
              Turning a feature off stops its background work right away. Your data stays — managed
              services, archives and history are untouched.
            </p>
            <FeaturePicker
              value={enabledModules}
              onChange={(next) => dispatch(setEnabledModules(next))}
            />
          </section>

          <section className="rounded-xl border border-border bg-paper p-5">
            <h2 className="text-base font-semibold text-fg">Appearance</h2>
            <div className="mt-2 divide-y divide-border">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-fg">Theme</p>
                  <p className="text-xs text-fg-muted">Match your system, or force light/dark.</p>
                </div>
                <SegmentedControl
                  ariaLabel="Theme"
                  value={theme}
                  options={THEME_OPTIONS}
                  onChange={(v) => dispatch(setTheme(v))}
                />
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-fg">Default layout</p>
                  <p className="text-xs text-fg-muted">
                    How services are shown on the Services tab.
                  </p>
                </div>
                <SegmentedControl
                  ariaLabel="Default layout"
                  value={layout}
                  options={LAYOUT_OPTIONS}
                  onChange={(v) => dispatch(setLayout(v))}
                />
              </div>
            </div>
          </section>

          <HomebrewStatusCard />

          <ManagedServicesEditor />
        </div>
      </div>
    </div>
  );
};
