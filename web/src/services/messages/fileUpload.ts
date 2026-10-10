import { uploadChatMedia } from '@/lib/api/messages';

/** Uploads a chat attachment to private storage; returns the storage path to send with the message. */
export const uploadMessageFile = async (matchId: string, file: File): Promise<string> => uploadChatMedia(matchId, file);
