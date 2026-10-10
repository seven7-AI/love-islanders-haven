import { Activity } from 'lucide-react';
import PrivacyControlsSection from './PrivacyControlsSection';

const ActivityStatusSection = () => (
  <PrivacyControlsSection title="Activity Status" icon={<Activity size={16} className="text-love" />}>
    <p className="text-sm text-muted-foreground">
      Online status and last-active times aren't shown to other members yet, so there's nothing to hide.
    </p>
  </PrivacyControlsSection>
);

export default ActivityStatusSection;
