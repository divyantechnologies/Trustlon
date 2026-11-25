export function DeliveryBadge({
  promise,
  compact = false,
}: {
  promise: 'same_day' | 'next_day';
  compact?: boolean;
}) {
  return (
    <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-600">
      {promise === 'same_day' ? (compact ? 'Same-day' : 'Same-day delivery') : 'Next-day delivery'}
    </span>
  );
}
