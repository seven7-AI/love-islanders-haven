import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface VerificationSectionProps {
  verified: boolean;
}

// Profile verification is granted server-side only; there is no self-service verification flow yet.
const VerificationSection = ({ verified }: VerificationSectionProps) => {
  return (
    <div>
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        {verified ? (
          <>
            <ShieldCheck size={18} className="text-green-400" />
            <span>Verified Profile</span>
          </>
        ) : (
          <>
            <ShieldAlert size={18} className="text-yellow-400" />
            <span>Unverified Profile</span>
          </>
        )}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">
        {verified
          ? "Your profile has been verified. This helps others trust you're a real person."
          : "Photo verification isn't available yet."}
      </p>
    </div>
  );
};

export default VerificationSection;
