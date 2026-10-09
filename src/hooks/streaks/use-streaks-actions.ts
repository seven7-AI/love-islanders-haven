import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { createStreakPost, setStreakLike, uploadStreakPhoto } from "@/lib/api/streaks";

/** Converts a data: URL from the post form into an uploadable Blob. */
const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/** Streak post actions; everything is saved through the API before success is reported. */
export const useStreaksActions = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostSubmit = async (postData: { content: string[]; duration?: number; caption?: string }) => {
    if (!postData.content?.length) {
      toast({ title: "Missing image", description: "Please select at least one image", variant: "destructive" });
      return false;
    }
    setIsSubmitting(true);
    try {
      const paths = [];
      for (const item of postData.content) {
        paths.push(await uploadStreakPhoto(await toBlob(item)));
      }
      const post = await createStreakPost({
        media_paths: paths,
        caption: postData.caption,
        duration_hours: postData.duration ?? 24,
      });
      toast({ title: "Posted!", description: `Your streak is now ${post.streak_count} day${post.streak_count === 1 ? '' : 's'}.` });
      return true;
    } catch (error) {
      toast({
        title: "Could not post your streak",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string, liked: boolean): Promise<number | null> => {
    try {
      return (await setStreakLike(postId, liked)).likes_count;
    } catch (error) {
      toast({
        title: "Could not save your like",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  return { handlePostSubmit, handleLikePost, isSubmitting };
};

export default useStreaksActions;
