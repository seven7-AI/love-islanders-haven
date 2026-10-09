import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, Loader2, Image, AlertCircle } from 'lucide-react';
import { deletePhoto, getMyProfile, ProfileImage, uploadProfilePhoto } from '@/lib/api/profile';
import { useToast } from '@/hooks/use-toast';

interface OnboardingPhotosProps {
  profileId: string;
  onNext: (data: any) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

// Must match MIN_PHOTOS_TO_COMPLETE / MAX_IMAGES in backend/app/services/profiles.py
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 6;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export const OnboardingPhotos = ({ onNext, onBack, isSubmitting }: OnboardingPhotosProps) => {
  const [photos, setPhotos] = useState<ProfileImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getMyProfile()
      .then((profile) => setPhotos(profile.images))
      .catch((error) =>
        toast({ title: 'Could not load your photos', description: error.message, variant: 'destructive' }),
      );
  }, [toast]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please choose a JPEG, PNG or WebP image',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Photos must be smaller than 5 MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      // Resolves only after the file is stored and the photo is saved to the profile.
      const photo = await uploadProfilePhoto(file);
      setPhotos((prev) => [...prev, photo]);
      toast({ title: 'Photo added', description: 'Your photo has been added to your profile' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (photo: ProfileImage) => {
    try {
      await deletePhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      toast({ title: 'Removed', description: 'The photo has been removed from your profile' });
    } catch (error: any) {
      toast({ title: 'Could not remove the photo', description: error.message, variant: 'destructive' });
    }
  };

  const handleContinue = () => {
    onNext({});
  };

  const missing = Math.max(0, MIN_PHOTOS - photos.length);

  return (
    <div className="bg-island-dark/80 backdrop-blur-sm rounded-lg p-6 text-white animate-fade-in shadow-lg border border-island-light/30">
      <h1 className="text-2xl font-bold mb-2 text-gradient">Add Your Photos</h1>
      <p className="text-gray-300 mb-4">
        Add at least {MIN_PHOTOS} photos (up to {MAX_PHOTOS}).
      </p>

      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-island-light/10">
        <AlertCircle className="h-4 w-4 text-love shrink-0" />
        <p className="text-sm">
          {missing > 0 ? (
            <span className="text-love">
              Add {missing} more photo{missing > 1 ? 's' : ''} to continue
            </span>
          ) : (
            <span className="text-green-400">
              ✓ Minimum photos added! You can add {MAX_PHOTOS - photos.length} more.
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative aspect-square bg-island-light/10 rounded-lg overflow-hidden group">
            <img src={photo.url} alt={`Profile ${index + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => handleDelete(photo)}
              className="absolute bottom-2 right-2 bg-red-500/80 hover:bg-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              aria-label={`Delete photo ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {index === 0 && <div className="absolute top-2 left-2 bg-love/90 text-xs px-2 py-0.5 rounded">Main</div>}
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <label className="relative aspect-square bg-island-light/10 rounded-lg border-2 border-dashed border-island-light/30 flex flex-col items-center justify-center cursor-pointer hover:bg-island-light/20 transition-colors">
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
              aria-label="Add photo"
            />
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-love" aria-label="Uploading" />
            ) : (
              <>
                <Image className="h-6 w-6 text-love mb-1" />
                <Plus className="h-4 w-4 text-love" />
                <span className="text-xs mt-1">Photo</span>
              </>
            )}
          </label>
        )}
      </div>

      <div className="flex space-x-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1" disabled={isSubmitting}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="flex-1 bg-love hover:bg-love-dark"
          disabled={missing > 0 || isUploading || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingPhotos;
