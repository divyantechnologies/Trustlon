'use client';
import Link from 'next/link';
import { useState } from 'react';
import { cn, focusRing } from '@/design-system';
import { Icon } from './Icon';
import { ProductImage } from './ProductImage';
export function HeroBannerCarousel() {
  const [index, setIndex] = useState(0);
  const images=['/images/home/audio.jpg','/images/home/headphones.jpg'];
  return (
    <section
      aria-label="Electronic & appliances promotion"
      aria-roledescription="carousel"
      className="relative overflow-hidden rounded-lg bg-navy text-white"
    >
      <div
        className="grid md:min-h-[410px] md:grid-cols-[1fr_1.05fr]"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of 2`}
      >
        <div className="relative z-10 flex flex-col justify-center px-6 py-7 sm:px-12 sm:py-10 md:py-14 lg:px-14">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white/70">
            <span className="h-px w-6 bg-teal" />
            ELECTRONIC & APPLIANCES
          </p>
          <h1 className="whitespace-pre-line text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
            Join fellow and collect
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">30% STOREWIDE VOUCHER · no minimum spend · + free shipping</p>
          <Link
            href="/browse/electronics"
            className="mt-5 inline-flex min-h-11 w-fit items-center gap-6 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-navy transition hover:bg-navy-50"
          >
            SHOP NOW
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/60">
            <Icon name="shield" className="h-4 w-4 text-logo-accent" />
            Thoughtfully picked. Trustlon protected.
          </p>
        </div>
        <div className="relative h-48 sm:h-60 md:h-full">
          <ProductImage
            key={images[index]}
            src={images[index]}
            alt={
              'Electronics campaign image'
            }
            className="h-full w-full object-cover"
            eager
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/20 to-transparent md:bg-gradient-to-r" />
          <span className="absolute right-5 top-5 rounded-lg bg-white/90 px-4 py-2 text-xs font-medium text-navy">
            Electrolux ESF 2000 Juicer W-Silver · $59.9
          </span>
        </div>
      </div>
      <div className="absolute bottom-3 left-6 right-5 flex items-center justify-between sm:left-12">
        <div className="flex gap-1" aria-label="Choose a campaign">
          {images.map((item, i) => (
            <button
              key={item}
              aria-label={`Show campaign ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
              className={cn('flex h-11 w-8 items-center justify-center rounded-lg', focusRing)}
            >
              <span
                className={cn(
                  'h-1.5 rounded-full',
                  i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40',
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              aria-label={direction === -1 ? 'Previous campaign' : 'Next campaign'}
              onClick={() => setIndex((index + direction + images.length) % images.length)}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-navy/60 hover:bg-navy',
                focusRing,
              )}
            >
              <Icon name="chevron" className={cn('h-4 w-4', direction === -1 && 'rotate-180')} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
