/** React Query key factory for brew-backed data. */
export const brewKeys = {
  all: ['brew'] as const,
  services: () => [...brewKeys.all, 'services'] as const,
};
