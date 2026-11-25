import Link from 'next/link';
import { cn, focusRing } from '@/design-system';
import type { CategoryDetail } from '../home/types';

/** No shared breadcrumb exists; keep the API-driven navigation local to this feature. */
export function CategoryBreadcrumb({ category }: { category: CategoryDetail }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <li>
          <Link
            className={cn('inline-flex min-h-11 items-center rounded-lg text-teal-600', focusRing)}
            href="/"
          >
            Home
          </Link>
        </li>
        {category.breadcrumb.map((item, index) => (
          <li key={item.slug} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            {index === category.breadcrumb.length - 1 ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <Link
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg text-teal-600',
                  focusRing,
                )}
                href={`/c/${encodeURIComponent(item.slug)}`}
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
