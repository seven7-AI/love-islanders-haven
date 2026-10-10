import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import SafeImage from '@/components/SafeImage';
import { useRoles } from '@/hooks/use-roles';
import { ApiError } from '@/lib/api/client';
import { REPORT_REASONS } from '@/lib/api/safety';
import { listReports, ModerationReport, ReportPerson, ReportStatus, reviewReport } from '@/lib/api/moderation';

type Filter = ReportStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];
const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};
const MAX_NOTE = 1000;

const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
const formatDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const Person = ({ person, extra }: { person: ReportPerson; extra?: string }) => (
  <span className="inline-flex items-center gap-2 min-w-0">
    <SafeImage src={person.photo_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
    <span className="truncate font-medium">{person.name ?? 'Unnamed user'}</span>
    {extra && <span className="text-xs text-muted-foreground whitespace-nowrap">{extra}</span>}
  </span>
);

const AccessDenied = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5" /> Moderators only
      </CardTitle>
      <CardDescription>
        This page is for the team that reviews reports. If you should have access, ask an administrator to grant you the
        moderator role.
      </CardDescription>
    </CardHeader>
  </Card>
);

/** The report review queue. The API checks the moderator role on every request; this page only mirrors it. */
const Moderation = () => {
  const { isModerator, loading: rolesLoading, error: rolesError } = useRoles();
  const [filter, setFilter] = useState<Filter>('open');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<ModerationReport | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<ReportStatus | null>(null);

  const status = filter === 'all' ? null : filter;

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 403 && err.code === 'forbidden') {
      setDenied(true); // the role was revoked since the page loaded
      return null;
    }
    return err instanceof Error && err.message ? err.message : fallback;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listReports({ status });
      setReports(page.reports);
      setCursor(page.next_cursor);
      setError(null);
    } catch (err) {
      setError(handleError(err, 'Could not load reports'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (isModerator) load();
  }, [isModerator, load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await listReports({ status, cursor });
      setReports((prev) => [...prev, ...page.reports]);
      setCursor(page.next_cursor);
    } catch (err) {
      const message = handleError(err, 'Could not load more reports');
      if (message) toast.error(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const open = (report: ModerationReport) => {
    setSelected(report);
    setNote(report.resolution_note ?? '');
  };

  const review = async (next: Exclude<ReportStatus, 'open'>) => {
    if (!selected) return;
    setSaving(next);
    try {
      const trimmed = note.trim();
      const updated = await reviewReport(selected.id, {
        status: next,
        ...(trimmed ? { resolution_note: trimmed } : {}),
      });
      setReports((prev) =>
        status && updated.status !== status
          ? prev.filter((r) => r.id !== updated.id)
          : prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      toast.success(`Report marked ${STATUS_LABEL[updated.status].toLowerCase()}`);
      setSelected(null);
    } catch (err) {
      const message = handleError(err, 'Could not save the review');
      if (message) toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  let body: ReactNode;
  if (rolesLoading) {
    body = (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-love" aria-label="Loading" />
      </div>
    );
  } else if (rolesError) {
    body = (
      <p role="alert" className="text-center text-white/80 py-8">
        Could not check your access: {rolesError}
      </p>
    );
  } else if (!isModerator || denied) {
    body = <AccessDenied />;
  } else {
    body = (
      <>
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as Filter)}
          aria-label="Report status"
          className="flex flex-wrap justify-start"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="text-white data-[state=on]:text-island-dark">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-love" aria-label="Loading reports" />
          </div>
        ) : error ? (
          <div className="text-center py-8 space-y-3">
            <p role="alert" className="text-white/80">
              {error}
            </p>
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-center text-white/70 py-8">
            {status ? `No ${STATUS_LABEL[status].toLowerCase()} reports.` : 'No reports yet.'}
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Reports">
            {reports.map((report) => (
              <li key={report.id}>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{reasonLabel(report.reason)}</h2>
                      <Badge variant={report.status === 'open' ? 'destructive' : 'secondary'}>
                        {STATUS_LABEL[report.status]}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground w-20 shrink-0">Reported</span>
                        <Person
                          person={report.reported}
                          extra={`${report.reported.reports_against} report${report.reported.reports_against === 1 ? '' : 's'}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground w-20 shrink-0">By</span>
                        <Person person={report.reporter} />
                      </div>
                    </div>
                    {report.details && <p className="text-sm italic break-words">“{report.details}”</p>}
                    <p className="text-xs text-muted-foreground">Filed {formatDate(report.created_at)}</p>
                    {report.reviewed_at && (
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABEL[report.status]} by {report.reviewed_by?.name ?? 'a former moderator'} on{' '}
                        {formatDate(report.reviewed_at)}
                        {report.resolution_note ? `: ${report.resolution_note}` : ''}
                      </p>
                    )}
                    <Button size="sm" variant="outline" onClick={() => open(report)}>
                      Review
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {cursor && !loading && !error && (
          <Button variant="secondary" className="w-full" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-island-dark via-island to-island-dark">
      <div className="page-container hide-scrollbar pb-32">
        <header className="container max-w-2xl mx-auto px-4 pt-4 mb-4">
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-love" /> Moderation
          </h1>
          <p className="text-sm text-white/70">Reports from users, oldest first.</p>
        </header>
        <main className="container max-w-2xl mx-auto px-4 space-y-4">{body}</main>
      </div>

      <Dialog open={selected !== null} onOpenChange={(isOpen) => !isOpen && !saving && setSelected(null)}>
        {selected && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review report: {reasonLabel(selected.reason)}</DialogTitle>
              <DialogDescription>
                {selected.reporter.name ?? 'A user'} reported {selected.reported.name ?? 'a user'} on{' '}
                {formatDate(selected.created_at)}. Your decision is recorded with your name. It does not suspend the
                account; reporting already blocked them for the reporter if they chose to.
              </DialogDescription>
            </DialogHeader>
            {selected.details && <p className="text-sm italic break-words">“{selected.details}”</p>}
            <div className="space-y-2">
              <Label htmlFor="resolution-note">Note (optional)</Label>
              <Textarea
                id="resolution-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={MAX_NOTE}
                rows={3}
                placeholder="What you checked and decided"
                disabled={saving !== null}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              {selected.status !== 'reviewing' && (
                <Button variant="outline" onClick={() => review('reviewing')} disabled={saving !== null}>
                  {saving === 'reviewing' ? 'Saving…' : 'Mark reviewing'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => review('dismissed')} disabled={saving !== null}>
                {saving === 'dismissed' ? 'Saving…' : 'Dismiss'}
              </Button>
              <Button onClick={() => review('resolved')} disabled={saving !== null}>
                {saving === 'resolved' ? 'Saving…' : 'Resolve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Moderation;
