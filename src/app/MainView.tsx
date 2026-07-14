import { Suspense } from 'react';
import { useAppSelector } from '@/shared/state/hooks';
import { Spinner } from '@/shared/ui/Spinner';
import { PAGES } from './MainView.config';

export const MainView = () => {
  const activeTab = useAppSelector((s) => s.ui.activeTab);
  const Page = PAGES[activeTab];

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
};
