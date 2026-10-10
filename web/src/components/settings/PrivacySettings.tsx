import { Shield } from 'lucide-react';
import SettingsSection from './SettingsSection';
import { LocationSharingSection, ActivityStatusSection, BlockReportSection } from './privacy';

const PrivacySettings = () => {
  return (
    <SettingsSection title="Privacy Settings" icon={<Shield size={20} />}>
      <div className="space-y-6">
        <LocationSharingSection />
        <ActivityStatusSection />
        <BlockReportSection />
      </div>
    </SettingsSection>
  );
};

export default PrivacySettings;
