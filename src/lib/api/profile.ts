import { supabase } from '@/integrations/supabase/client';
import { apiFetch } from './client';

export interface ProfileImage {
  id: string;
  url: string;
  position: number;
  is_visible: boolean;
}

export interface OwnProfile {
  id: string;
  name: string | null;
  display_name: string | null;
  bio: string | null;
  dob: string | null;
  age: number | null;
  gender: string | null;
  gender_preference: string | null;
  relationship_goal: string | null;
  height_cm: number | null;
  occupation: string | null;
  education: string | null;
  exercise: string | null;
  drinking_habit: string | null;
  smoking_habit: string | null;
  communication_style: string | null;
  love_language: string | null;
  zodiac_sign: string | null;
  hometown: string | null;
  pronouns: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  interests: string[];
  age_range_min: number | null;
  age_range_max: number | null;
  distance_preference: number | null;
  show_age: boolean;
  show_me_verified_only: boolean;
  verified: boolean;
  email_verified: boolean;
  streak_count: number;
  onboarding_completed: boolean;
  onboarding_step: string | null;
  images: ProfileImage[];
}

export type OnboardingStep =
  'basics' | 'photos' | 'interests' | 'lifestyle' | 'personality' | 'preferences' | 'completed';

/** Fields the API accepts in PATCH /v1/me/profile (server-managed fields are rejected). */
const EDITABLE_FIELDS = [
  'name',
  'display_name',
  'bio',
  'dob',
  'gender',
  'gender_preference',
  'relationship_goal',
  'height_cm',
  'occupation',
  'education',
  'exercise',
  'drinking_habit',
  'smoking_habit',
  'communication_style',
  'love_language',
  'zodiac_sign',
  'hometown',
  'pronouns',
  'location',
  'city',
  'country',
  'interests',
  'age_range_min',
  'age_range_max',
  'distance_preference',
  'show_age',
  'show_me_verified_only',
] as const;

const CAMEL_ALIASES: Record<string, string> = {
  genderPreference: 'gender_preference',
  relationshipGoal: 'relationship_goal',
  showAge: 'show_age',
  heightCm: 'height_cm',
  drinking: 'drinking_habit',
  smoking: 'smoking_habit',
  displayName: 'display_name',
};

/** Picks the editable fields from UI form data (snake_case or the camelCase aliases older components use). */
export function toProfileUpdate(data: Record<string, unknown>): Record<string, unknown> {
  // snake_case keys win over their camelCase aliases regardless of key order
  const normalized: Record<string, unknown> = { ...data };
  for (const [alias, field] of Object.entries(CAMEL_ALIASES)) {
    if (normalized[field] === undefined && data[alias] !== undefined) normalized[field] = data[alias];
  }
  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    const value = normalized[field];
    if (value !== undefined) update[field] = value === '' ? null : value;
  }
  return update;
}

export const getMyProfile = () => apiFetch<OwnProfile>('/v1/me/profile');

export const updateMyProfile = (data: Record<string, unknown>) =>
  apiFetch<OwnProfile>('/v1/me/profile', { method: 'PATCH', body: toProfileUpdate(data) });

export const setOnboardingStep = (step: OnboardingStep) =>
  apiFetch<OwnProfile>('/v1/me/onboarding', { method: 'PUT', body: { step } });

interface UploadTicket {
  bucket: string;
  path: string;
  token: string;
  upload_url: string;
}

/** Uploads a photo directly to storage with a server-issued signed URL, then adds it to the profile. */
export async function uploadProfilePhoto(file: File): Promise<ProfileImage> {
  const ticket = await apiFetch<UploadTicket>('/v1/me/images/uploads', {
    method: 'POST',
    body: { content_type: file.type, size_bytes: file.size },
  });
  const { error } = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, {
    contentType: file.type,
  });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  return apiFetch<ProfileImage>('/v1/me/images', { method: 'POST', body: { path: ticket.path } });
}

export const setPhotoVisibility = (id: string, isVisible: boolean) =>
  apiFetch<ProfileImage>(`/v1/me/images/${id}`, { method: 'PATCH', body: { is_visible: isVisible } });

export const reorderPhotos = (imageIds: string[]) =>
  apiFetch<ProfileImage[]>('/v1/me/images/order', { method: 'PUT', body: { image_ids: imageIds } });

export const deletePhoto = (id: string) => apiFetch<void>(`/v1/me/images/${id}`, { method: 'DELETE' });
