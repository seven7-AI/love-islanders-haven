import { CircleCheck } from 'lucide-react';
import { relationshipGoalLabel, type ProfileView } from '@/lib/profile-view';

interface ProfileDetailsProps {
  profile: ProfileView;
}

const Chip = ({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) => (
  <span
    className={`text-xs px-2 py-1 rounded-full ${accent ? 'bg-love/20 text-love' : 'bg-island-light/20 text-white'}`}
  >
    {children}
  </span>
);

const ProfileDetails = ({ profile }: ProfileDetailsProps) => {
  // On your own profile the age stays visible, with a note when it is hidden from others.
  const age = profile.age ? (profile.showAge ? `${profile.age}` : `${profile.age} (hidden from others)`) : '';
  const goal = relationshipGoalLabel(profile.relationshipGoal);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">{profile.name}</h2>
        {age && <span className="text-xl">{age}</span>}

        {profile.verified && (
          <span className="ml-1 text-love flex items-center" title="Verified Profile">
            <CircleCheck size={20} className="fill-love text-island-dark" />
          </span>
        )}
      </div>

      {profile.bio && <p className="text-sm text-white/90">{profile.bio}</p>}

      <div className="flex flex-wrap gap-2">
        {profile.occupation && <Chip>{profile.occupation}</Chip>}
        {profile.education && <Chip>{profile.education}</Chip>}
        {profile.location && <Chip>{profile.location}</Chip>}
        {profile.heightCm && <Chip>{profile.heightCm} cm</Chip>}
        {goal && <Chip accent>{goal}</Chip>}
      </div>

      {profile.interests.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Interests">
          {profile.interests.map((interest) => (
            <li key={interest} className="text-xs bg-white/10 text-white px-2 py-1 rounded-full">
              {interest}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProfileDetails;
