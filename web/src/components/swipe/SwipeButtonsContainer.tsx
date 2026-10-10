import { Heart, X, Star } from 'lucide-react';
import SwipeButton from './SwipeButton';

interface SwipeButtonsContainerProps {
  onSwipe?: (direction: 'left' | 'right') => void;
  onSuperLike?: () => void;
  disabled?: boolean;
}

const SwipeButtonsContainer = ({ onSwipe, onSuperLike, disabled }: SwipeButtonsContainerProps) => (
  <div className="flex justify-center gap-3 mt-4 pb-16" aria-disabled={disabled}>
    <SwipeButton onClick={() => !disabled && onSwipe?.('left')} icon={X} color="rose-500" size="md" ariaLabel="Pass" />
    {onSuperLike && (
      <SwipeButton
        onClick={() => !disabled && onSuperLike()}
        icon={Star}
        color="blue-500"
        size="sm"
        ariaLabel="Super Like"
      />
    )}
    <SwipeButton
      onClick={() => !disabled && onSwipe?.('right')}
      icon={Heart}
      color="green-500"
      size="md"
      ariaLabel="Like"
    />
  </div>
);

export default SwipeButtonsContainer;
