import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmailConfirmationNotice from './EmailConfirmationNotice';

interface EmailVerificationPopupProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
}

const EmailVerificationPopup = ({ isOpen, email, onClose }: EmailVerificationPopupProps) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="bg-island-dark border-island-light">
      <DialogHeader>
        <DialogTitle className="text-white">Confirm your email</DialogTitle>
        <DialogDescription>Some features need a confirmed email address.</DialogDescription>
      </DialogHeader>
      <EmailConfirmationNotice email={email} />
    </DialogContent>
  </Dialog>
);

export default EmailVerificationPopup;
