import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import EmailVerificationPopup from '@/components/auth/EmailVerificationPopup';
import { useDiscoverProfiles } from '@/hooks/discover/useDiscoverProfiles';
import { useEmailVerification } from '@/hooks/discover/useEmailVerification';
import ProfileDisplay from '@/components/discover/ProfileDisplay';
import SimpleDiscoverFilters, { SimpleFilters } from '@/components/discover/SimpleDiscoverFilters';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SwipeDirection } from '@/lib/api/discovery';
import { DEFAULT_DISCOVER_PREFERENCES } from '@/services/profiles/profile-preferences';

const Discover: React.FC = () => {
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { currentProfile, isLoading, swiping, error, filters, setFilters, refreshProfiles, handleSwipe } =
    useDiscoverProfiles();
  const { showVerificationPopup, email: unconfirmedEmail, handleVerificationComplete } = useEmailVerification();

  const simpleFilters: SimpleFilters = {
    ageRange: [filters.minAge, filters.maxAge],
    distance: filters.maxDistance,
    gender: filters.gender ?? 'any',
  };

  const apply = (next: SimpleFilters) => {
    setFilters({
      minAge: next.ageRange[0],
      maxAge: next.ageRange[1],
      maxDistance: next.distance,
      gender: next.gender === 'any' ? undefined : next.gender,
    });
  };

  const onSwipe = async (profileId: string, direction: SwipeDirection) => {
    const name = currentProfile?.name ?? 'them';
    const result = await handleSwipe(profileId, direction);
    if (result?.matched) {
      toast.success(`It's a match with ${name}!`, {
        description: 'Say hello from your matches.',
        action: { label: 'Open matches', onClick: () => navigate('/matches') },
      });
    }
  };

  const activeCount =
    (filters.minAge !== DEFAULT_DISCOVER_PREFERENCES.minAge || filters.maxAge !== DEFAULT_DISCOVER_PREFERENCES.maxAge
      ? 1
      : 0) +
    (filters.maxDistance !== DEFAULT_DISCOVER_PREFERENCES.maxDistance ? 1 : 0) +
    (filters.gender ? 1 : 0);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
      <ScrollArea className="h-full w-full overflow-auto">
        <div className="container mx-auto px-4 py-8 pb-24">
          <h1 className="text-3xl font-bold text-center text-white mb-6">Discover People</h1>

          {currentProfile && !isLoading ? (
            <ProfileDisplay profile={currentProfile} disabled={swiping} onSwipe={onSwipe} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              {error ? (
                <>
                  <p role="alert" className="text-white text-center">
                    Could not load profiles: {error}
                  </p>
                  <Button variant="secondary" onClick={refreshProfiles}>
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-white text-center">
                    {isLoading ? 'Loading profiles…' : 'No more profiles match your preferences right now.'}
                  </p>
                  {!isLoading && (
                    <Button variant="secondary" onClick={() => setIsFilterOpen(true)}>
                      Adjust filters
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          <SimpleDiscoverFilters
            isOpen={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            activeFilters={simpleFilters}
            onApply={apply}
          />

          <EmailVerificationPopup
            isOpen={showVerificationPopup}
            email={unconfirmedEmail}
            onClose={handleVerificationComplete}
          />

          <div className="fixed bottom-20 left-6 z-10">
            <Button
              onClick={() => setIsFilterOpen(true)}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2 bg-neutral-800/90 text-white hover:bg-neutral-700 rounded-full px-5 py-2 shadow-lg"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-purple-600 text-white text-[10px]"
                >
                  {activeCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Discover;
