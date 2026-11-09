'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/language-provider';
import { useHome } from '../home-provider';
import { ProductImage } from './ProductImage';
export function CategoryTiles() {
  const { language } = useI18n();
  const categories = useHome().home?.categories ?? [];
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="categories-title">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-teal-600">
            Find your next favourite
          </p>
          <h2 id="categories-title" className="text-2xl font-semibold">
            {language === 'hi' ? 'श्रेणी के अनुसार खरीदें' : 'A little something for everyone'}
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-5">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/browse/${category.slug}`}
            className="group rounded-lg text-center"
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-white">
              <ProductImage
                src={category.image ?? ''}
                alt=""
                className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
              />
            </div>
            <p className="mt-3 min-h-11 text-xs font-medium group-hover:text-teal-600 sm:text-sm">
              {language === 'hi' && category.nameHi ? category.nameHi : category.name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
