import { MessageSquare } from 'lucide-react';
import SettingsSection from './SettingsSection';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/context/SettingsContext';
import { useState } from 'react';

const CommunicationSettings = () => {
  const { settings, updateSettings } = useSettings();
  const [isUpdating, setIsUpdating] = useState(false);
  const notificationsEnabled = settings.communication_settings.notifications_enabled ?? true;

  const handleNotificationsChange = async (checked: boolean) => {
    setIsUpdating(true);
    await updateSettings('communication_settings', { ...settings.communication_settings, notifications_enabled: checked });
    setIsUpdating(false);
  };

  return (
    <SettingsSection title="Communication Settings" icon={<MessageSquare size={20} />}>
      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-love">Notifications</h4>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label htmlFor="notifications-enabled" className="cursor-pointer">Notifications</Label>
              <span className="text-xs text-muted-foreground">Get notified about new matches and messages</span>
            </div>
            <Switch
              id="notifications-enabled"
              checked={notificationsEnabled}
              disabled={isUpdating}
              onCheckedChange={handleNotificationsChange}
            />
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-island-light/30">
          <h4 className="text-sm font-medium text-love">Messaging</h4>
          <p className="text-xs text-muted-foreground">
            Read receipts are always on: your matches can see when you've read their messages, and you can see when
            they've read yours.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
};

export default CommunicationSettings;
