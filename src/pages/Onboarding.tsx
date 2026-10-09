import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { OnboardingBasics } from '@/components/onboarding/OnboardingBasics';
import { OnboardingPhotos } from '@/components/onboarding/OnboardingPhotos';
import { OnboardingInterests } from '@/components/onboarding/OnboardingInterests';
import { OnboardingLifestyle } from '@/components/onboarding/OnboardingLifestyle';
import { OnboardingPersonality } from '@/components/onboarding/OnboardingPersonality';
import { OnboardingPreferences } from '@/components/onboarding/OnboardingPreferences';
import { OnboardingCompletion } from '@/components/onboarding/OnboardingCompletion';
import { getMyProfile, setOnboardingStep, updateMyProfile, type OnboardingStep } from '@/lib/api/profile';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const steps: OnboardingStep[] = ['basics', 'photos', 'interests', 'lifestyle', 'personality', 'preferences', 'completed'];

const stepLabels: Record<OnboardingStep, string> = {
  basics: 'Basics',
  photos: 'Photos',
  interests: 'Interests',
  lifestyle: 'Lifestyle',
  personality: 'Personality',
  preferences: 'Preferences',
  completed: 'Done'
};

export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basics');
  const [profileData, setProfileData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login', { replace: true });
        return;
      }
      
      try {
        const profile = await getMyProfile();
        if (profile.onboarding_completed) {
          navigate('/discover', { replace: true });
          return;
        }
        if (profile.onboarding_step && steps.includes(profile.onboarding_step as OnboardingStep)) {
          setCurrentStep(profile.onboarding_step as OnboardingStep);
        }
        setProfileData(profile);
      } catch (error: any) {
        toast({
          title: "Could not load your profile",
          description: error.message || "Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  const handleNext = async (stepData: any) => {
    setIsSaving(true);
    
    try {
      const updatedProfileData = { ...profileData, ...stepData };
      setProfileData(updatedProfileData);
      
      const currentIndex = steps.indexOf(currentStep);
      const nextStep = steps[currentIndex + 1] as OnboardingStep;

      // Unknown and server-managed fields (age, verification flags) are dropped by updateMyProfile.
      await updateMyProfile(stepData);
      // The server checks that the profile is complete before accepting 'completed'.
      await setOnboardingStep(nextStep);

      setCurrentStep(nextStep);
      
      if (nextStep === 'completed') {
        toast({
          title: "Profile Completed! 🎉",
          description: "You're ready to start meeting people.",
        });
        
        // Redirect immediately after showing toast
        setTimeout(() => {
          navigate('/discover', { replace: true });
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error saving onboarding data:", error);
      toast({
        title: "Error Saving Data",
        description: error.message || "Failed to save your information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleBack = async () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const previousStep = steps[currentIndex - 1] as OnboardingStep;
      setCurrentStep(previousStep);
      
      try {
        await setOnboardingStep(previousStep);
      } catch (error) {
        console.error('Error updating onboarding progress:', error);
      }
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-island-dark">
        <Loader2 className="h-12 w-12 animate-spin text-love" />
      </div>
    );
  }
  
  const renderStep = () => {
    switch (currentStep) {
      case 'basics':
        return <OnboardingBasics 
          initialData={profileData} 
          onNext={handleNext} 
          isSubmitting={isSaving}
        />;
      case 'photos':
        return <OnboardingPhotos 
          profileId={profileData.id} 
          onNext={handleNext} 
          onBack={handleBack}
          isSubmitting={isSaving}
        />;
      case 'interests':
        return <OnboardingInterests
          initialData={profileData}
          onNext={handleNext}
          onBack={handleBack}
          isSubmitting={isSaving}
        />;
      case 'lifestyle':
        return <OnboardingLifestyle 
          initialData={profileData} 
          onNext={handleNext} 
          onBack={handleBack}
          isSubmitting={isSaving}
        />;
      case 'personality':
        return <OnboardingPersonality 
          initialData={profileData} 
          onNext={handleNext} 
          onBack={handleBack}
          isSubmitting={isSaving}
        />;
      case 'preferences':
        return <OnboardingPreferences 
          initialData={profileData} 
          onNext={handleNext} 
          onBack={handleBack}
          isSubmitting={isSaving}
        />;
      case 'completed':
        return <OnboardingCompletion />;
      default:
        return null;
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-island-dark via-island to-island-dark overflow-y-auto z-50">
      <div className="container max-w-md mx-auto px-4 py-8 pb-16">
        <OnboardingProgress 
          currentStep={currentStep} 
          steps={steps.filter(step => step !== 'completed')}
          stepLabels={stepLabels}
        />
        {renderStep()}
      </div>
    </div>
  );
};

export default Onboarding;
