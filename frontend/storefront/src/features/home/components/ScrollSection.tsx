'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { cn, focusRing } from '@/design-system';
import { Icon } from './Icon';
export function ScrollSection({
  title,
  subtitle,
  href,
  aside,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const track = ref.current;
    if (!track) return;
    const update = () =>
      setEdges({
        start: track.scrollLeft < 2,
        end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
      });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', update);
    };
  }, [children]);
  const scroll = (direction: number) => {
    const track = ref.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <h2 id={id} className="text-2xl font-semibold">
              {title}
            </h2>
            {aside}
          </div>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Link
              href={href}
              className="mr-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-teal-600"
            >
              View all
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          )}
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              disabled={direction === -1 ? edges.start : edges.end}
              onClick={() => scroll(direction)}
              aria-label={`${direction === -1 ? 'Previous' : 'Next'} ${title}`}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40',
                focusRing,
              )}
            >
              <Icon name="chevron" className={cn('h-4 w-4', direction === -1 && 'rotate-180')} />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        role="region"
        aria-label={`${title} carousel`}
        tabIndex={0}
        className={cn(
          'grid snap-x snap-mandatory auto-cols-[78%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain rounded-lg pb-3 focus-visible:outline-teal sm:auto-cols-[45%] [&>*]:snap-start',
          wide ? 'lg:auto-cols-[calc((100%-3rem)/4)]' : 'lg:auto-cols-[calc((100%-4rem)/5)]',
        )}
      >
        {children}
      </div>
    </section>
  );
}
