import { useState } from 'react';
import { useProfilePage } from '@/hooks/use-profile-page';
import type { ProfileView } from '@/lib/profile-view';

import ProfileHeader from '@/components/profile/layout/ProfileHeader';
import ProfileTabs from '@/components/profile/layout/ProfileTabs';
import ProfileEditContent from '@/components/profile/layout/ProfileEditContent';
import ProfileLoadingState from '@/components/profile/layout/ProfileLoadingState';
import ProfileErrorState from '@/components/profile/layout/ProfileErrorState';

const Profile = () => {
  const {
    profile,
    isLoading,
    isEditing,
    error,
    handleEditProfile,
    handleRetry,
    handleImagesChange,
    handleVerificationSuccess,
    handlePreferencesUpdated,
  } = useProfilePage();

  if (!profile) {
    return error && !isLoading ? (
      <ProfileErrorState onRetry={() => void handleRetry()} errorMessage={error} />
    ) : (
      <ProfileLoadingState />
    );
  }

  return (
    <ProfileContent
      profile={profile}
      isEditing={isEditing}
      handleEditProfile={handleEditProfile}
      handleImagesChange={handleImagesChange}
      handleVerificationSuccess={handleVerificationSuccess}
      handlePreferencesUpdated={handlePreferencesUpdated}
    />
  );
};

// Extract the content to a separate component to make the main component cleaner
interface ProfileContentProps {
  profile: ProfileView;
  isEditing: boolean;
  handleEditProfile: () => void;
  handleImagesChange: (newImages: string[]) => void;
  handleVerificationSuccess: () => void;
  handlePreferencesUpdated: () => void;
}

const ProfileContent = ({
  profile,
  isEditing,
  handleEditProfile,
  handleImagesChange,
  handleVerificationSuccess,
  handlePreferencesUpdated,
}: ProfileContentProps) => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-screen bg-gradient-to-b from-island-dark via-island to-island-dark pb-20">
      <div className="page-container">
        <ProfileHeader isEditing={isEditing} onEditToggle={handleEditProfile} />

        {!isEditing ? (
          <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} onEdit={handleEditProfile} />
        ) : (
          <ProfileEditContent
            profile={profile}
            onDoneEditing={handleEditProfile}
            onImagesChange={handleImagesChange}
            onVerificationSuccess={handleVerificationSuccess}
            onPreferencesUpdated={handlePreferencesUpdated}
          />
        )}
      </div>
    </div>
  );
};

export default Profile;
