import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src: string | null | undefined;
  alt: string;
  /**
   * Called once when the image fails to load, for sources that expire (signed URLs). Returns a new source to try,
   * or null if there is none.
   */
  onExpired?: () => Promise<string | null>;
}

/**
 * A remote image that loads lazily and, when it cannot be loaded, shows a placeholder of the same size instead of a
 * broken image. With `onExpired` it first asks for a fresh source once.
 */
const SafeImage = ({ src, alt, className, onExpired, loading = 'lazy', ...rest }: SafeImageProps) => {
  const [current, setCurrent] = useState(src ?? null);
  const [failed, setFailed] = useState(!src);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setCurrent(src ?? null);
    setFailed(!src);
    setRetried(false);
  }, [src]);

  const handleError = async () => {
    if (onExpired && !retried) {
      setRetried(true);
      try {
        const fresh = await onExpired();
        if (fresh) {
          setCurrent(fresh);
          return;
        }
      } catch {
        // fall through to the placeholder
      }
    }
    setFailed(true);
  };

  if (failed || !current) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt ? `${alt} (unavailable)` : undefined}
        aria-hidden={alt ? undefined : true}
        className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}
      >
        <ImageOff className="h-1/3 max-h-8 w-1/3 max-w-8" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={handleError}
      className={className}
      {...rest}
    />
  );
};

export default SafeImage;
