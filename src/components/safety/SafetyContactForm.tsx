import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { SafetyContact, SafetyContactInput } from '@/lib/api/safety';

interface SafetyContactFormProps {
  initial?: SafetyContact;
  isSaving?: boolean;
  submitLabel?: string;
  /** Resolves true when the contact was saved. */
  onSubmit: (input: SafetyContactInput) => Promise<boolean>;
  onCancel: () => void;
}

const SafetyContactForm = ({
  initial,
  isSaving,
  submitLabel = 'Save Contact',
  onSubmit,
  onCancel,
}: SafetyContactFormProps) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const idPrefix = initial ? `contact-${initial.id}` : 'contact-new';

  const hasReachableDetail = phone.trim() !== '' || email.trim() !== '';
  const canSubmit = name.trim() !== '' && hasReachableDetail && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const input: SafetyContactInput = { name: name.trim(), is_primary: isPrimary };
    if (phone.trim()) input.phone = phone.trim();
    if (email.trim()) input.email = email.trim();
    const saved = await onSubmit(input);
    if (saved && !initial) {
      setName('');
      setPhone('');
      setEmail('');
      setIsPrimary(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-3 border rounded-md">
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contact name"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-phone`}>Phone number</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
        />
      </div>
      {!hasReachableDetail && <p className="text-xs text-muted-foreground">Add a phone number or an email address.</p>}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${idPrefix}-primary`}
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked === true)}
        />
        <Label htmlFor={`${idPrefix}-primary`}>Primary contact</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default SafetyContactForm;
