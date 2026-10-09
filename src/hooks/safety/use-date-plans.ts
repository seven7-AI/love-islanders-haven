import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  DatePlan,
  DatePlanInput,
  DatePlanStatus,
  DatePlanUpdate,
  createDatePlan,
  deleteDatePlan,
  fetchDatePlans as fetchDatePlansApi,
  updateDatePlan as updateDatePlanApi,
} from '@/lib/api/safety';

export type { DatePlan, DatePlanInput, DatePlanStatus, DatePlanUpdate };

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** The signed-in user's date plans. Mutations report API errors to the user and resolve to null/false. */
export function useDatePlans({ autoLoad = true }: { autoLoad?: boolean } = {}) {
  const [datePlans, setDatePlans] = useState<DatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Loads the plans; rejects with the API error so callers can show it. */
  const fetchDatePlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const plans = await fetchDatePlansApi();
      setDatePlans(plans);
      setError(null);
      return plans;
    } catch (err) {
      setError(message(err, 'Could not load your date plans'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) fetchDatePlans().catch(() => undefined);
  }, [autoLoad, fetchDatePlans]);

  const addDatePlan = async (plan: DatePlanInput): Promise<DatePlan | null> => {
    setIsSaving(true);
    try {
      const created = await createDatePlan(plan);
      setDatePlans((prev) => [created, ...prev]);
      toast.success(`"${created.title}" has been added to your date plans`);
      return created;
    } catch (err) {
      toast.error(message(err, 'Could not save the date plan'));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const updateDatePlan = async (id: string, changes: DatePlanUpdate): Promise<DatePlan | null> => {
    setIsSaving(true);
    try {
      const updated = await updateDatePlanApi(id, changes);
      setDatePlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      toast.error(message(err, 'Could not update the date plan'));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const removeDatePlan = async (id: string): Promise<boolean> => {
    setIsSaving(true);
    try {
      await deleteDatePlan(id);
      setDatePlans((prev) => prev.filter((p) => p.id !== id));
      toast.success('Date plan deleted');
      return true;
    } catch (err) {
      toast.error(message(err, 'Could not delete the date plan'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { datePlans, isLoading, isSaving, error, fetchDatePlans, addDatePlan, updateDatePlan, removeDatePlan };
}
