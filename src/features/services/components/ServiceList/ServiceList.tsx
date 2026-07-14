import { ServiceRow } from '@/features/services/components/ServiceRow';
import type { ReconciledService } from '@/shared/brew';

export const ServiceList = ({ services }: { services: ReconciledService[] }) => (
  <div className="flex flex-col gap-2">
    {services.map((s) => (
      <ServiceRow key={s.formula} service={s} />
    ))}
  </div>
);
