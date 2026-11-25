'use client';
import { cn, focusRing } from '@/design-system';
import { RADII, type Radius } from '../query';

export function DistanceFilter({
  value,
  onChange,
}: {
  value: Radius;
  onChange: (radius: Radius) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Distance from your pincode</legend>
      <div className="flex flex-wrap gap-2">
        {RADII.map((radius) => (
          <label key={radius} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="local-radius"
              value={radius}
              checked={value === radius}
              onChange={() => onChange(radius)}
              aria-label={`Within ${radius} km`}
            />
            <span
              className={cn(
                'flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-teal peer-focus-visible:ring-offset-2',
                focusRing,
                value === radius
                  ? 'border-teal bg-teal-50 text-teal-600'
                  : 'border-slate-300 bg-white text-navy',
              )}
            >
              Within {radius} km
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
