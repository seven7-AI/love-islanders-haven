import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { REPORT_REASONS as REASONS, ReportReason, reportUser } from '@/lib/api/safety';

const MAX_DETAILS = 1000;

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  /** Called after a report that also blocked the user was accepted. */
  onBlocked: () => void;
}

const ReportUserDialog = ({ open, onOpenChange, userId, userName, onBlocked }: ReportUserDialogProps) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setReason('');
    setDetails('');
    setAlsoBlock(true);
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      await reportUser({
        user_id: userId,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
        also_block: alsoBlock,
      });
      toast.success(
        alsoBlock ? `Thanks. ${userName} has been reported and blocked.` : `Thanks. ${userName} has been reported.`,
      );
      reset();
      onOpenChange(false);
      if (alsoBlock) onBlocked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {userName}</DialogTitle>
          <DialogDescription>Reports are confidential. {userName} won't know who reported them.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <RadioGroup value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              {REASONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`report-${option.value}`} />
                  <Label htmlFor={`report-${option.value}`} className="font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={MAX_DETAILS}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us what happened"
            />
            <p className="text-xs text-muted-foreground text-right">
              {details.length}/{MAX_DETAILS}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="report-also-block"
              checked={alsoBlock}
              onCheckedChange={(checked) => setAlsoBlock(checked === true)}
            />
            <Label htmlFor="report-also-block">Also block {userName}</Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!reason || isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportUserDialog;
