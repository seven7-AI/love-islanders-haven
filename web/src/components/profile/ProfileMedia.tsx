import ProfileMediaSection from './ProfileMediaSection';
import type { ProfileView } from '@/lib/profile-view';

interface ProfileMediaProps {
  profile: ProfileView;
  visibleImagesIndices?: number[];
  isMyProfile?: boolean;
}

const ProfileMedia = ({ profile, visibleImagesIndices, isMyProfile = false }: ProfileMediaProps) => {
  return (
    <div className="space-y-4">
      <ProfileMediaSection profile={profile} visibleImagesIndices={visibleImagesIndices} isMyProfile={isMyProfile} />
    </div>
  );
};

export default ProfileMedia;
