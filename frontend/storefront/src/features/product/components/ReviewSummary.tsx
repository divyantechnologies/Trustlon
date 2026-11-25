import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
import { number } from '../helpers';
export function ReviewSummary({
  rating,
  config,
}: {
  rating?: Product['rating'];
  config: CategoryConfig;
}) {
  if (!rating?.count) return null;
  const rank = (label: string) => {
    const i = config.featureLabels.indexOf(label);
    return i < 0 ? 99 : i;
  };
  return (
    <div className="mb-7 grid gap-6 border-b border-slate-100 pb-7 sm:grid-cols-[160px_1fr] lg:grid-cols-[160px_1fr_1fr]">
      <div>
        <p className="text-5xl font-semibold tracking-tight">
          {rating.average.toFixed(1)}
          <span className="text-lg text-slate-400"> / 5</span>
        </p>
        <p className="mt-2 text-sm text-slate-500">{number(rating.count)} ratings</p>
      </div>
      {rating.distribution && (
        <div className="space-y-2" aria-label="Rating distribution">
          {([5, 4, 3, 2, 1] as const).map((n) => (
            <div key={n} className="flex items-center gap-3 text-xs">
              <span className="w-6">{n} ★</span>
              <meter
                className="h-2 min-w-0 flex-1 accent-teal-600"
                min={0}
                max={Math.max(rating.count, 1)}
                value={rating.distribution?.[n] ?? 0}
                aria-label={`${n} star ratings`}
              />
              <span className="w-10 text-right text-slate-500">
                {number(rating.distribution?.[n] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
      {!!rating.featureRatings?.length && (
        <div className="space-y-3">
          {rating.featureRatings
            .slice()
            .sort((a, b) => rank(a.label) - rank(b.label))
            .map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{f.label}</span>
                  <span>{f.value.toFixed(1)}/5</span>
                </div>
                <meter
                  min={0}
                  max={5}
                  value={f.value}
                  aria-label={`${f.label} rating`}
                  className="h-2 w-full accent-teal-600"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
