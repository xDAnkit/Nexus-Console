import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Conditional class composition + Tailwind conflict resolution. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
