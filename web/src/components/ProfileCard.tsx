import { useState, useRef } from 'react';
import type { ProfileView } from '@/lib/profile-view';
import { Info, MessageCircle } from 'lucide-react';
import ProfileImageCarousel from './profile/ProfileImageCarousel';
import ProfileInfoPanel from './profile/ProfileInfoPanel';
import ProfileCommentInput from './profile/ProfileCommentInput';
import ProfileBottomInfo from './profile/ProfileBottomInfo';
import SwipeIndicator from './profile/SwipeIndicator';

interface ProfileCardProps {
  profile: ProfileView;
  onSwipe: (direction: 'left' | 'right') => void;
}

const ProfileCard = ({ profile, onSwipe }: ProfileCardProps) => {
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Never show someone else's photo in place of a missing one.
  const images = profile.images.length > 0 ? profile.images : ['/placeholder.svg'];

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwiping) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newOffsetX = clientX - startX;
    setOffsetX(newOffsetX);
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    const threshold = 100;
    // The Discover page reports the saved result (errors, matches); no optimistic toast here.
    if (offsetX > threshold) {
      onSwipe('right');
    } else if (offsetX < -threshold) {
      onSwipe('left');
    }

    setIsSwiping(false);
    setOffsetX(0);
  };

  const toggleMoreInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMoreInfo(!showMoreInfo);
  };

  const toggleCommentInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCommentInput(!showCommentInput);
  };

  const cardStyle = {
    transform: isSwiping ? `translateX(${offsetX}px) rotate(${offsetX * 0.03}deg)` : 'translateX(0) rotate(0)',
  };

  return (
    <div
      ref={cardRef}
      className="relative w-full max-w-md mx-auto h-[62dvh] max-h-[640px] overflow-hidden rounded-xl shadow-xl bg-black/10"
      style={cardStyle}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-full w-full">
        {/* Image Carousel */}
        <ProfileImageCarousel images={images} name={profile.name} />

        {/* Swipe Indicator (like/dislike) */}
        <SwipeIndicator offsetX={offsetX} />

        {/* More info button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleMoreInfo}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm"
            aria-label="More information"
          >
            <Info size={18} className="text-white" />
          </button>
        </div>

        {/* Comment button */}
        {/* Removed the comment button here */}

        {/* Comment input overlay */}
        {showCommentInput && <ProfileCommentInput onClose={() => setShowCommentInput(false)} />}

        {/* More info panel */}
        {showMoreInfo && <ProfileInfoPanel profile={profile} onClose={toggleMoreInfo} />}

        {/* Profile info at bottom */}
        {!showMoreInfo && <ProfileBottomInfo profile={profile} />}
      </div>
    </div>
  );
};

export default ProfileCard;
