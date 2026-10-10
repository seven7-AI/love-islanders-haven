import React, { useState } from 'react';
import { Ban, Flag, MoreVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { blockUser } from '@/lib/api/safety';
import ReportUserDialog from './ReportUserDialog';

interface InlineChatHeaderProps {
  matchName: string;
  /** The other person's user id; enables the block/report menu. */
  partnerId?: string;
  onClose: () => void;
  /** Called after the partner was blocked (directly or through a report). */
  onBlocked?: () => void;
}

const InlineChatHeader: React.FC<InlineChatHeaderProps> = ({ matchName, partnerId, onClose, onBlocked }) => {
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const displayName = matchName || 'this person';

  const handleBlock = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!partnerId) return;
    setIsBlocking(true);
    try {
      await blockUser(partnerId);
      toast.success(`${displayName} has been blocked`);
      setConfirmBlock(false);
      onBlocked?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not block this user');
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="bg-island p-4 border-b border-island-light/20 flex justify-between items-center">
      <h3 className="font-semibold text-white">{matchName}</h3>
      <div className="flex items-center gap-1">
        {partnerId && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-island-light/20"
                aria-label="Chat options"
              >
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConfirmBlock(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Block
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                <Flag className="mr-2 h-4 w-4" />
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-island-light/20"
          aria-label="Close chat"
        >
          <X size={18} />
        </Button>
      </div>

      {partnerId && (
        <>
          <AlertDialog open={confirmBlock} onOpenChange={(open) => !isBlocking && setConfirmBlock(open)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Block {displayName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You won't see each other or be able to message each other. You can unblock them later in Settings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isBlocking}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBlock} disabled={isBlocking}>
                  {isBlocking ? 'Blocking…' : 'Block'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ReportUserDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            userId={partnerId}
            userName={displayName}
            onBlocked={() => onBlocked?.()}
          />
        </>
      )}
    </div>
  );
};

export default InlineChatHeader;
