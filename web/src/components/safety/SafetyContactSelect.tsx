import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SafetyContact } from '@/lib/api/safety';

const NONE = 'none';

interface SafetyContactSelectProps {
  id?: string;
  contacts: SafetyContact[];
  /** Selected contact id, or '' for none. */
  value: string;
  onChange: (id: string) => void;
}

const SafetyContactSelect = ({ id, contacts, value, onChange }: SafetyContactSelectProps) => {
  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a safety contact above to link one to this plan.</p>;
  }

  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a safety contact" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No contact</SelectItem>
        {contacts.map((contact) => (
          <SelectItem key={contact.id} value={contact.id}>
            {contact.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default SafetyContactSelect;
