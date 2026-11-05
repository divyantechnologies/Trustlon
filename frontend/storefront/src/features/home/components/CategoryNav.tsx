'use client';
import Link from 'next/link';
import { useState } from 'react';
import { cn, focusRing } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { categories } from '../data/categories';
import { Icon } from './Icon';
export function CategoryNav() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const { language } = useI18n();
  const category = categories.find((item) => item.id === open);
  return (
    <nav
      aria-label="Product categories"
      className="relative z-20 border-y border-slate-200 bg-white"
      onMouseLeave={() => setOpen(null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(null);
          setMobile(false);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null);
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          className={cn('flex h-12 items-center gap-3 rounded-lg font-medium lg:hidden', focusRing)}
          onClick={() => setMobile(!mobile)}
          aria-expanded={mobile}
        >
          <Icon name="menu" />
          {language === 'hi' ? 'सभी श्रेणियाँ' : 'Shop by category'}
          <Icon name="down" className="h-4 w-4" />
        </button>
        <div
          className={cn(
            'flex-col gap-1 pb-3 lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:pb-0',
            mobile ? 'flex' : 'hidden',
          )}
        >
          {categories.map((item) => (
            <button
              key={item.id}
              aria-expanded={open === item.id}
              aria-controls="category-menu"
              onMouseEnter={() => {
                if (window.matchMedia('(min-width: 1024px) and (hover: hover)').matches)
                  setOpen(item.id);
              }}
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className={cn(
                'flex min-h-12 items-center justify-between gap-2 rounded-lg px-2 text-sm font-medium hover:text-teal-600',
                focusRing,
                open === item.id && 'text-teal-600',
              )}
            >
              <span>{language === 'hi' ? item.hi : item.name}</span>
              <Icon name="down" className="h-3 w-3" />
            </button>
          ))}
          <Link
            href="/browse/deals"
            className="flex min-h-12 items-center gap-2 px-2 font-semibold text-teal-600"
          >
            <Icon name="star" className="h-4 w-4" />
            Today’s deals
          </Link>
        </div>
        {category && (
          <div
            id="category-menu"
            className="absolute left-4 right-4 top-full rounded-b-lg border border-slate-200 bg-white p-6 shadow-sm sm:left-6 sm:right-6 lg:left-1/2 lg:w-[min(70rem,90vw)] lg:-translate-x-1/2"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="mb-4 text-lg font-semibold">
                  Explore {language === 'hi' ? category.hi : category.name}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {category.children.map((name) => (
                    <Link
                      key={name}
                      href={`/browse/${category.id}?section=${encodeURIComponent(name)}`}
                      onClick={() => {
                        setOpen(null);
                        setMobile(false);
                      }}
                      className="min-h-11 rounded-lg px-4 py-3 text-slate-500 hover:bg-navy-50 hover:text-navy"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/browse/${category.id}`}
                  onClick={() => {
                    setOpen(null);
                    setMobile(false);
                  }}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-teal-600"
                >
                  Shop all {category.name}
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>
              <button
                aria-label="Close category menu"
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                  focusRing,
                )}
                onClick={() => setOpen(null)}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
