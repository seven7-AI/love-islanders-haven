import { Settings, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Links from the profile to settings and the safety centre (the navigation bar shows them only on wider screens). */
const ProfileActionBar = () => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={() => navigate('/settings')}>
        <Settings size={16} className="mr-2" aria-hidden />
        Settings
      </Button>
      <Button variant="outline" className="flex-1" onClick={() => navigate('/safety')}>
        <Shield size={16} className="mr-2" aria-hidden />
        Safety
      </Button>
    </div>
  );
};

export default ProfileActionBar;
