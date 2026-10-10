import SwipeButtonsContainer from './swipe/SwipeButtonsContainer';

interface SwipeButtonsProps {
  onSwipe?: (direction: 'left' | 'right') => void;
  onSuperLike?: () => void;
  disabled?: boolean;
}

const SwipeButtons = (props: SwipeButtonsProps) => <SwipeButtonsContainer {...props} />;

export default SwipeButtons;
