import { cn } from '@/shared/lib/cn';
import logo from '@/assets/logo.png';

interface SplashScreenProps {
  /** true → fade out over the app content (crossfade exit). */
  leaving?: boolean;
}

/** Branded launch splash — themed canvas + logo, shown while Bootstrap gates
 * first paint, then crossfaded out over the app. Reduced motion is handled by
 * the global override in index.css. */
export const SplashScreen = ({ leaving = false }: SplashScreenProps) => (
  <div
    aria-hidden
    className={cn(
      'fixed inset-0 z-[var(--z-toast)] flex items-center justify-center bg-canvas',
      'transition-opacity duration-[var(--duration-slow)] ease-[var(--ease-standard)]',
      leaving ? 'opacity-0' : 'opacity-100',
    )}
  >
    <img src={logo} alt="" draggable={false} className="nx-splash-logo size-24" />
  </div>
);
