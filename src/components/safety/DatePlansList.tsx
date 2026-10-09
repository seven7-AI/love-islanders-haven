import { format } from 'date-fns';
import { CheckCircle2, MapPin, Trash2, User, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DatePlan, DatePlanStatus, SafetyContact } from '@/lib/api/safety';

interface DatePlansListProps {
  plans: DatePlan[];
  contacts: SafetyContact[];
  isSaving?: boolean;
  onStatusChange: (id: string, status: DatePlanStatus) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABEL: Record<DatePlanStatus, string> = {
  planned: 'Planned',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const sortKey = (plan: DatePlan) => (plan.date_time ? new Date(plan.date_time).getTime() : Number.MAX_SAFE_INTEGER);

const DatePlansList = ({ plans, contacts, isSaving, onStatusChange, onDelete }: DatePlansListProps) => {
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">You don't have any date plans yet.</p>;
  }

  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name;
  const sorted = [...plans].sort((a, b) => sortKey(a) - sortKey(b));

  return (
    <ul className="space-y-2">
      {sorted.map((plan) => (
        <li key={plan.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="font-medium">{plan.title}</p>
              {plan.date_time && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(plan.date_time), 'EEE d MMM yyyy, h:mm a')}
                </p>
              )}
            </div>
            <Badge variant={plan.status === 'planned' ? 'secondary' : 'outline'}>{STATUS_LABEL[plan.status]}</Badge>
          </div>
          {plan.partner_name && (
            <p className="text-sm flex items-center gap-1">
              <User className="h-3 w-3" /> With {plan.partner_name}
            </p>
          )}
          {plan.location && (
            <p className="text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {plan.location}
            </p>
          )}
          {plan.contact_id && contactName(plan.contact_id) && (
            <p className="text-xs text-muted-foreground">Safety contact: {contactName(plan.contact_id)}</p>
          )}
          {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {plan.status === 'planned' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={isSaving}
                  onClick={() => onStatusChange(plan.id, 'completed')}
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark as done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={isSaving}
                  onClick={() => onStatusChange(plan.id, 'cancelled')}
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              aria-label={`Delete ${plan.title}`}
              disabled={isSaving}
              onClick={() => onDelete(plan.id)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default DatePlansList;
