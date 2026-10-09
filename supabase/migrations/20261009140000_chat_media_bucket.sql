-- Private bucket for chat photos and voice notes (#15). There are deliberately no storage policies for it:
-- browsers upload with API-issued signed upload URLs and read through short-lived signed URLs, so only the API
-- (service role) can list, read or delete objects directly.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;
