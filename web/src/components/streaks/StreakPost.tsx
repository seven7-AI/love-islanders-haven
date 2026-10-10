import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Flame, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { StreakPost as StreakPostType } from './types';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface StreakPostProps {
  post: StreakPostType;
  /** Saves the like state; resolves to the server's like count, or null if it failed. */
  onLike: (liked: boolean) => Promise<number | null>;
}

const StreakPost = ({ post, onLike }: StreakPostProps) => {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saving, setSaving] = useState(false);

  const handleLike = async () => {
    setSaving(true);
    const count = await onLike(!liked);
    if (count !== null) {
      setLiked(!liked);
      setLikesCount(count);
    }
    setSaving(false);
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  // Check if content is an array
  const contentArray = Array.isArray(post.content)
    ? post.content
    : typeof post.content === 'string'
      ? [post.content]
      : [];

  const hasMultipleImages = contentArray.length > 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          {post.user_profile_image ? (
            <img src={post.user_profile_image} alt={post.user_name} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{post.user_name}</p>
              <div className="flex items-center gap-1 text-sm text-love">
                <Flame className="h-3 w-3" />
                <span>{post.streak_count}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Image carousel for multiple images */}
        {contentArray.length > 0 ? (
          <Carousel className="w-full">
            <CarouselContent>
              {contentArray.map((imageUrl, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-square">
                    <img src={imageUrl} alt={`Streak post ${index + 1}`} className="w-full h-full object-cover" />
                    {hasMultipleImages && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
                        {index + 1}/{contentArray.length}
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {hasMultipleImages && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          // Fallback for posts with no valid content
          <div className="w-full aspect-square bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">No image available</p>
          </div>
        )}

        <div className="p-4">{post.caption && <p className="mb-2">{post.caption}</p>}</div>
      </CardContent>
      <CardFooter className="px-4 py-2 flex justify-between">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            disabled={saving}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
            className={`flex items-center gap-1 ${liked ? 'text-love' : ''}`}
          >
            <Heart className={`h-5 w-5 ${liked ? 'fill-love' : ''}`} />
            <span>{likesCount}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default StreakPost;
