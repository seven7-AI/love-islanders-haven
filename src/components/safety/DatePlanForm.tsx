import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DatePlanInput, SafetyContact } from '@/lib/api/safety';
import SafetyContactSelect from './SafetyContactSelect';

interface DatePlanFormProps {
  contacts: SafetyContact[];
  isSaving?: boolean;
  /** Resolves true when the plan was saved. */
  onSubmit: (plan: DatePlanInput) => Promise<boolean>;
}

/** Combines the picked day with an "HH:mm" time into an ISO timestamp. */
const combine = (day: Date, time: string) => {
  const [hours, minutes] = (time || '19:00').split(':').map(Number);
  const result = new Date(day);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result.toISOString();
};

const DatePlanForm = ({ contacts, isSaving, onSubmit }: DatePlanFormProps) => {
  const [title, setTitle] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [location, setLocation] = useState('');
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('19:00');
  const [notes, setNotes] = useState('');
  const [contactId, setContactId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const plan: DatePlanInput = { title: title.trim() };
    if (partnerName.trim()) plan.partner_name = partnerName.trim();
    if (location.trim()) plan.location = location.trim();
    if (day) plan.date_time = combine(day, time);
    if (notes.trim()) plan.notes = notes.trim();
    // Only the user's own contacts can be linked to a plan.
    if (contactId && contacts.some((c) => c.id === contactId)) plan.contact_id = contactId;

    if (await onSubmit(plan)) {
      setTitle('');
      setPartnerName('');
      setLocation('');
      setDay(undefined);
      setTime('19:00');
      setNotes('');
      setContactId('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plan-title">What's the plan?</Label>
        <Input
          id="plan-title"
          placeholder="Coffee, dinner, a walk…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-partner">Who are you meeting?</Label>
        <Input
          id="plan-partner"
          placeholder="Their name"
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-location">Meeting location</Label>
        <Input
          id="plan-location"
          placeholder="Where you're meeting"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {day ? format(day, 'PP') : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={day}
                onSelect={setDay}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-time">Time</Label>
          <Input id="plan-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!day} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-notes">Notes</Label>
        <Textarea
          id="plan-notes"
          placeholder="Anything your contact should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-contact">Safety contact</Label>
        <SafetyContactSelect id="plan-contact" contacts={contacts} value={contactId} onChange={setContactId} />
      </div>

      <Button type="submit" className="w-full" disabled={!title.trim() || isSaving}>
        Save date plan
      </Button>
    </form>
  );
};

export default DatePlanForm;
