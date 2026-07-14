import { Database, Globe, Layers, Box, type LucideIcon } from 'lucide-react';

const DB = [
  'postgresql',
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'mongodb-community',
  'memcached',
];

/** Icon per formula (ignoring @version), matching the original app. */
export function iconFor(formula: string): LucideIcon {
  const base = formula.split('@')[0];
  if (base === 'redis' || base === 'valkey') return Layers;
  if (base === 'nginx') return Globe;
  if (DB.includes(base)) return Database;
  return Box;
}
