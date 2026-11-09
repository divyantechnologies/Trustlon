'use client';
import { useState } from 'react';
import { Icon } from './Icon';
export function ProductImage({
  src,
  alt,
  className = '',
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div
        className={`flex items-center justify-center bg-navy-50 text-slate-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Icon name="bag" className="h-12 w-12" />
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
