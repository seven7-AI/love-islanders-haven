import { useNavigate } from 'react-router-dom';
import { Loader2, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmergencyButton from '@/components/safety/EmergencyButton';
import SafetyContactsCard from '@/components/safety/SafetyContactsCard';
import DatePlanForm from '@/components/safety/DatePlanForm';
import DatePlansList from '@/components/safety/DatePlansList';
import { useSafetyContacts } from '@/hooks/safety/use-safety-contacts';
import { useDatePlans } from '@/hooks/safety/use-date-plans';
import { toast } from 'sonner';

const Safety = () => {
  const navigate = useNavigate();
  const contacts = useSafetyContacts();
  const plans = useDatePlans();

  return (
    <div className="min-h-screen bg-gradient-to-b from-island-dark via-island to-island-dark">
      <div className="page-container hide-scrollbar pb-32">
        <header className="container max-w-xl mx-auto px-4 pt-4 mb-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-white">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <Shield className="h-6 w-6 text-love" /> Safety
          </h1>
          <div className="w-12"></div>
        </header>

        <main className="container max-w-xl mx-auto px-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emergency</CardTitle>
              <CardDescription>If you are in immediate danger, call your local emergency number first.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="gap-2">
                <a href="tel:112">
                  <Phone className="h-4 w-4" /> Call emergency services (112)
                </a>
              </Button>
              <EmergencyButton contacts={contacts.safetyContacts} />
            </CardContent>
          </Card>

          <SafetyContactsCard
            contacts={contacts.safetyContacts}
            isLoading={contacts.isLoading}
            isSaving={contacts.isSaving}
            error={contacts.error}
            onRetry={contacts.fetchSafetyContacts}
            onAdd={contacts.addSafetyContact}
            onUpdate={contacts.updateSafetyContact}
            onRemove={contacts.removeSafetyContact}
          />

          <Card>
            <CardHeader>
              <CardTitle>Plan a date</CardTitle>
              <CardDescription>Keep a record of where you're going and who you're meeting.</CardDescription>
            </CardHeader>
            <CardContent>
              <DatePlanForm
                contacts={contacts.safetyContacts}
                isSaving={plans.isSaving}
                onSubmit={async (plan) => (await plans.addDatePlan(plan)) !== null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your date plans</CardTitle>
            </CardHeader>
            <CardContent>
              {plans.isLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-love" />
                </div>
              ) : plans.error ? (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-destructive">
                    {plans.error}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => plans.fetchDatePlans().catch(() => undefined)}>
                    Try again
                  </Button>
                </div>
              ) : (
                <DatePlansList
                  plans={plans.datePlans}
                  contacts={contacts.safetyContacts}
                  isSaving={plans.isSaving}
                  onStatusChange={async (id, status) => {
                    if (await plans.updateDatePlan(id, { status })) {
                      toast.success(status === 'completed' ? 'Marked as done' : 'Date plan cancelled');
                    }
                  }}
                  onDelete={plans.removeDatePlan}
                />
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Safety;
