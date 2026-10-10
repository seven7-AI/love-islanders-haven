import React from 'react';
import ProfileCard from '@/components/ProfileCard';
import SwipeButtons from '@/components/SwipeButtons';
import type { PublicProfile, SwipeDirection } from '@/lib/api/discovery';

interface ProfileDisplayProps {
  profile: PublicProfile;
  disabled: boolean;
  onSwipe: (profileId: string, direction: SwipeDirection) => void;
}

// Shown when a profile has no visible photos (never another person's photo).
const PLACEHOLDER_IMAGE = '/placeholder.svg';

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile, disabled, onSwipe }) => {
  const cardProfile = {
    ...profile,
    name: profile.name ?? 'Someone',
    age: profile.age ?? undefined,
    images: profile.images.length > 0 ? profile.images : [PLACEHOLDER_IMAGE],
  };

  return (
    <>
      <ProfileCard profile={cardProfile as any} onSwipe={(direction) => onSwipe(profile.id, direction)} />
      <SwipeButtons
        disabled={disabled}
        onSwipe={(direction) => onSwipe(profile.id, direction)}
        onSuperLike={() => onSwipe(profile.id, 'super')}
      />
    </>
  );
};

export default ProfileDisplay;
