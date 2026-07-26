import { Dialog } from '@/shared/ui/Dialog';
import { AutomationCard } from '@/features/archiver/components/AutomationCard';
import { RetentionControl } from '@/features/archiver/components/RetentionControl';

/** All archive knobs in one place: tray automation + Claude's retention. */
export const ArchiveSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title="Archive settings"
    description="Automation runs while the app sits in the tray — no restart needed."
  >
    <AutomationCard />
    <div className="mt-4 border-t border-border pt-4">
      <RetentionControl />
    </div>
  </Dialog>
);
