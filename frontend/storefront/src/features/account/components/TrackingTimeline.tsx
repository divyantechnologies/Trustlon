'use client';
import { cn } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { formatDateTime, STATUS_LABELS } from '../format';
import type { ShipmentEvent, SubOrderStatus } from '../types';

const JOURNEY: SubOrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

interface Step {
  key: string;
  title: string;
  detail: string | null;
  done: boolean;
  current: boolean;
  stopped?: boolean;
}

/**
 * Delivery steps with the time each one happened. Steps not reached yet are shown greyed out,
 * so the customer can see what comes next. A cancelled item shows what happened, then the cancellation.
 */
export function TrackingTimeline({
  status,
  events,
}: {
  status: SubOrderStatus;
  events: ShipmentEvent[];
}) {
  const byStatus = new Map<SubOrderStatus, ShipmentEvent>();
  for (const event of events) byStatus.set(event.status, event);

  let steps: Step[];
  if (status === 'CANCELLED' || status === 'RETURN_REQUESTED' || status === 'RETURNED') {
    steps = events.map((event, index) => ({
      key: `${event.status}-${index}`,
      title: event.title,
      detail: [formatDateTime(event.occurredAt), event.location].filter(Boolean).join(' · '),
      done: true,
      current: index === events.length - 1,
      stopped: event.status === 'CANCELLED',
    }));
  } else {
    const reached = JOURNEY.indexOf(status);
    steps = JOURNEY.map((step, index) => {
      const event = byStatus.get(step);
      return {
        key: step,
        title: event?.title ?? STATUS_LABELS[step],
        detail: event
          ? [formatDateTime(event.occurredAt), event.location].filter(Boolean).join(' · ')
          : null,
        done: index <= reached,
        current: index === reached,
      };
    });
  }

  return (
    <ol className="relative">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'absolute left-[9px] top-5 h-[calc(100%-12px)] w-0.5',
                steps[index + 1].done ? 'bg-teal' : 'bg-slate-200',
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
              step.stopped
                ? 'border-slate-400 bg-slate-400 text-white'
                : step.done
                  ? 'border-teal bg-teal text-white'
                  : 'border-slate-300 bg-white',
            )}
          >
            {step.stopped ? (
              <Icon name="close" className="h-3 w-3" strokeWidth={3} />
            ) : (
              step.done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm', step.done ? 'font-semibold text-navy' : 'text-slate-400')}>
              {step.title}
              {step.current && <span className="sr-only"> (current status)</span>}
            </p>
            {step.detail && <p className="text-xs text-slate-500">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
