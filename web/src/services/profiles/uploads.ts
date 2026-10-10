import { uploadProfilePhoto } from '@/lib/api/profile';

/**
 * Uploads a profile photo and adds it to the signed-in user's profile. Returns the photo URL.
 */
export const uploadProfileImage = async (file: File): Promise<string> => {
  const image = await uploadProfilePhoto(file);
  return image.url;
};
