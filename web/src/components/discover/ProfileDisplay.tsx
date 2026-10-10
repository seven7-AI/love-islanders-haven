import React from 'react';
import ProfileCard from '@/components/ProfileCard';
import SwipeButtons from '@/components/SwipeButtons';
import type { PublicProfile, SwipeDirection } from '@/lib/api/discovery';
import { fromPublicProfile } from '@/lib/profile-view';

interface ProfileDisplayProps {
  profile: PublicProfile;
  disabled: boolean;
  onSwipe: (profileId: string, direction: SwipeDirection) => void;
}

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile, disabled, onSwipe }) => {
  return (
    <>
      <ProfileCard profile={fromPublicProfile(profile)} onSwipe={(direction) => onSwipe(profile.id, direction)} />
      <SwipeButtons
        disabled={disabled}
        onSwipe={(direction) => onSwipe(profile.id, direction)}
        onSuperLike={() => onSwipe(profile.id, 'super')}
      />
    </>
  );
};

export default ProfileDisplay;
