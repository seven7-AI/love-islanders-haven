import { useState } from 'react';
import { Loader2, Mail, Pencil, Phone, Star, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_SAFETY_CONTACTS, SafetyContact, SafetyContactInput, SafetyContactUpdate } from '@/lib/api/safety';
import SafetyContactForm from './SafetyContactForm';

interface SafetyContactsCardProps {
  contacts: SafetyContact[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: (input: SafetyContactInput) => Promise<SafetyContact | null>;
  onUpdate: (id: string, changes: SafetyContactUpdate) => Promise<SafetyContact | null>;
  onRemove: (id: string) => Promise<boolean>;
}

const SafetyContactsCard = ({
  contacts,
  isLoading,
  isSaving,
  error,
  onRetry,
  onAdd,
  onUpdate,
  onRemove,
}: SafetyContactsCardProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const atLimit = contacts.length >= MAX_SAFETY_CONTACTS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Safety contacts</CardTitle>
        <CardDescription>
          People you trust. You can add up to {MAX_SAFETY_CONTACTS} and link one to each date plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-love" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {contacts.length === 0 && !isAdding && (
              <p className="text-sm text-muted-foreground">You haven't added any safety contacts yet.</p>
            )}
            <ul className="space-y-2">
              {contacts.map((contact) =>
                editingId === contact.id ? (
                  <li key={contact.id}>
                    <SafetyContactForm
                      initial={contact}
                      isSaving={isSaving}
                      submitLabel="Save changes"
                      onCancel={() => setEditingId(null)}
                      onSubmit={async (input) => {
                        const saved = await onUpdate(contact.id, {
                          ...input,
                          phone: input.phone || null,
                          email: input.email || null,
                        });
                        if (saved) setEditingId(null);
                        return saved !== null;
                      }}
                    />
                  </li>
                ) : (
                  <li key={contact.id} className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium flex items-center gap-2">
                        {contact.name}
                        {contact.is_primary && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" /> Primary
                          </Badge>
                        )}
                      </p>
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {contact.email}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${contact.name}`}
                        onClick={() => setEditingId(contact.id)}
                        disabled={isSaving}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${contact.name}`}
                        onClick={() => onRemove(contact.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
            {isAdding ? (
              <SafetyContactForm
                isSaving={isSaving}
                onCancel={() => setIsAdding(false)}
                onSubmit={async (input) => {
                  const saved = await onAdd(input);
                  if (saved) setIsAdding(false);
                  return saved !== null;
                }}
              />
            ) : atLimit ? (
              <p className="text-xs text-muted-foreground">
                You've reached the limit of {MAX_SAFETY_CONTACTS} safety contacts.
              </p>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={() => setIsAdding(true)}>
                <UserPlus className="h-4 w-4" />
                Add a safety contact
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SafetyContactsCard;
