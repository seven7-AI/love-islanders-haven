import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Bell, Mail, MessageSquare, Phone } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApiError } from '@/lib/api/client';
import { ALERTS_NOT_CONFIGURED, SafetyContact, sendEmergencyAlert } from '@/lib/api/safety';

interface EmergencyButtonProps {
  contacts: SafetyContact[];
  className?: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

type Result = { kind: 'sent' } | { kind: 'not_configured' } | { kind: 'failed'; message: string };

/** Emergency number that works across the EU and on most mobile networks worldwide. */
const EMERGENCY_NUMBER = '112';

const getLocation = (): Promise<Coordinates | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  });

const helpMessage = (location: Coordinates | null) =>
  location
    ? `I need help. My location: https://maps.google.com/?q=${location.latitude},${location.longitude}`
    : 'I need help. Please call me.';

const EmergencyServicesLink = () => (
  <a href={`tel:${EMERGENCY_NUMBER}`} className="inline-flex items-center gap-2 font-semibold underline">
    <Phone className="h-4 w-4" />
    Call emergency services ({EMERGENCY_NUMBER})
  </a>
);

const EmergencyButton = ({ contacts, className }: EmergencyButtonProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);

  const manualContact = contacts.find((c) => c.is_primary) ?? contacts[0];

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setResult(null);
  };

  const handleConfirmAlert = async () => {
    setIsSending(true);
    setResult(null);
    const coords = await getLocation();
    setLocation(coords);
    try {
      await sendEmergencyAlert({ message: helpMessage(coords), ...(coords ?? {}) });
      setResult({ kind: 'sent' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 503 && err.code === ALERTS_NOT_CONFIGURED) {
        setResult({ kind: 'not_configured' });
      } else {
        setResult({ kind: 'failed', message: err instanceof Error ? err.message : 'The alert could not be sent.' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const text = encodeURIComponent(helpMessage(location));

  return (
    <>
      <Button variant="destructive" className={`gap-2 ${className ?? ''}`} onClick={() => setIsDialogOpen(true)}>
        <Bell className="h-4 w-4" />
        Emergency Alert
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Send Emergency Alert
            </DialogTitle>
            <DialogDescription>
              Asks Love Islander to alert your safety contacts, with your current location if you allow it.
            </DialogDescription>
          </DialogHeader>

          {result?.kind === 'sent' && (
            <Alert>
              <AlertDescription>Alert sent to your safety contacts.</AlertDescription>
            </Alert>
          )}

          {(result?.kind === 'not_configured' || result?.kind === 'failed') && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>
                {result.kind === 'not_configured'
                  ? "Emergency alerts aren't set up yet"
                  : 'The alert could not be sent'}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {result.kind === 'failed' && `${result.message} `}
                  Your safety contacts have not received an alert from us.
                </p>
                <p>If you are in danger, call your local emergency number.</p>
                <EmergencyServicesLink />
                {manualContact && (manualContact.phone || manualContact.email) && (
                  <div className="space-y-1">
                    <p>Or contact {manualContact.name} yourself:</p>
                    <div className="flex flex-wrap gap-3">
                      {manualContact.phone && (
                        <a
                          href={`sms:${manualContact.phone}?body=${text}`}
                          className="inline-flex items-center gap-1 underline"
                        >
                          <MessageSquare className="h-4 w-4" /> Text {manualContact.name}
                        </a>
                      )}
                      {manualContact.phone && (
                        <a href={`tel:${manualContact.phone}`} className="inline-flex items-center gap-1 underline">
                          <Phone className="h-4 w-4" /> Call {manualContact.name}
                        </a>
                      )}
                      {manualContact.email && (
                        <a
                          href={`mailto:${manualContact.email}?subject=${encodeURIComponent('I need help')}&body=${text}`}
                          className="inline-flex items-center gap-1 underline"
                        >
                          <Mail className="h-4 w-4" /> Email {manualContact.name}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!result && (
            <div className="space-y-2 text-sm">
              {contacts.length === 0 && (
                <Alert variant="destructive">
                  <AlertDescription>You haven't added any safety contacts yet.</AlertDescription>
                </Alert>
              )}
              <p className="text-muted-foreground">In immediate danger? Don't wait for an alert:</p>
              <EmergencyServicesLink />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSending}>
              Close
            </Button>
            {!result && (
              <Button variant="destructive" onClick={handleConfirmAlert} disabled={isSending || contacts.length === 0}>
                {isSending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Sending...
                  </>
                ) : (
                  'Send Alert'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmergencyButton;
