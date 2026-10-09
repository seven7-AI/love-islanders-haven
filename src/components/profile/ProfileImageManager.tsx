import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ProfileImageGrid from './image-controls/ProfileImageGrid';
import VerificationSection from './verification/VerificationSection';
import {
  deletePhoto,
  getMyProfile,
  ProfileImage,
  reorderPhotos,
  setPhotoVisibility,
  uploadProfilePhoto,
} from '@/lib/api/profile';

interface ProfileImageManagerProps {
  images: string[];
  verified: boolean;
  onImagesChange: (images: string[]) => void;
}

const MAX_IMAGES = 6;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');

/** Manages the signed-in user's photos; every change is saved through the API before the UI reflects it. */
const ProfileImageManager = ({ verified, onImagesChange }: ProfileImageManagerProps) => {
  const [photos, setPhotos] = useState<ProfileImage[]>([]);

  const apply = (next: ProfileImage[]) => {
    const sorted = [...next].sort((a, b) => a.position - b.position);
    setPhotos(sorted);
    onImagesChange(sorted.filter((p) => p.is_visible).map((p) => p.url));
  };

  useEffect(() => {
    getMyProfile()
      .then((profile) => apply(profile.images))
      .catch((error) => toast.error(`Could not load your photos: ${errorMessage(error)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageUploaded = async (file: File) => {
    try {
      const photo = await uploadProfilePhoto(file);
      apply([...photos, photo]);
      toast.success('Photo added');
      return photo.url;
    } catch (error) {
      toast.error(`Could not add the photo: ${errorMessage(error)}`);
      return null;
    }
  };

  const handleRemoveImage = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    try {
      await deletePhoto(photo.id);
      apply(photos.filter((p) => p.id !== photo.id).map((p, i) => ({ ...p, position: i })));
      toast.success('Photo removed');
    } catch (error) {
      toast.error(`Could not remove the photo: ${errorMessage(error)}`);
    }
  };

  const handleToggleVisibility = async (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    try {
      const updated = await setPhotoVisibility(photo.id, !photo.is_visible);
      apply(photos.map((p) => (p.id === updated.id ? updated : p)));
    } catch (error) {
      toast.error(`Could not update the photo: ${errorMessage(error)}`);
    }
  };

  const move = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= photos.length) return;
    const ids = photos.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      apply(await reorderPhotos(ids));
    } catch (error) {
      toast.error(`Could not reorder photos: ${errorMessage(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-love">Profile Photos</h2>
        <div className="text-xs text-muted-foreground">
          {photos.length}/{MAX_IMAGES} photos
        </div>
      </div>

      <ProfileImageGrid
        images={photos.map((p) => p.url)}
        visibleImages={photos.flatMap((p, i) => (p.is_visible ? [i] : []))}
        maxImages={MAX_IMAGES}
        onImageUploaded={handleImageUploaded}
        onRemoveImage={handleRemoveImage}
        onToggleVisibility={handleToggleVisibility}
        onMoveImageUp={(i) => move(i, -1)}
        onMoveImageDown={(i) => move(i, 1)}
      />

      <div className="text-xs text-muted-foreground">
        Add up to {MAX_IMAGES} photos (JPEG, PNG or WebP, up to 5 MB). Hidden photos are only visible to you.
      </div>

      <div className="pt-4 border-t border-island-light">
        <VerificationSection verified={verified} />
      </div>
    </div>
  );
};

export default ProfileImageManager;
