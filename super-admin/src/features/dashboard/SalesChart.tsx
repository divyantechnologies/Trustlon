'use client';

import { useMemo, useState } from 'react';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { count, date, money, moneyCompact } from '@/lib/format';

export interface DayPoint {
  day: string;
  ownPaise: number;
  thirdPartyPaise: number;
  orders: number;
}

/** Validated pair (dataviz validator, light and dark): Trustlon teal and a clear blue. */
const SERIES = [
  { key: 'ownPaise', label: 'Trustlon brand', color: '#1F9E8C' },
  { key: 'thirdPartyPaise', label: 'Third-party sellers', color: '#5B6FD8' },
] as const;

const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= value) return step * exp;
  return 10 * exp;
}

/** GMV per day, stacked by own brand and third-party sellers (5.1 SalesChart). */
export function SalesChart({ points }: { points: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = useMemo(
    () => niceMax(Math.max(0, ...points.map((p) => p.ownPaise + p.thirdPartyPaise))),
    [points],
  );
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.min(24, Math.max(2, band - 4));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(points.length / 8);
  const active = hover === null ? null : points[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-4 text-xs text-slate-600" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className={cn('rounded text-xs font-semibold text-teal-600 hover:underline', focusRing)}
        >
          {table ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {table ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 text-end font-semibold">Trustlon brand</th>
                <th className="px-3 py-2 text-end font-semibold">Third-party</th>
                <th className="px-3 py-2 text-end font-semibold">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {points.map((p) => (
                <tr key={p.day}>
                  <td className="px-3 py-1.5">{date(p.day)}</td>
                  <td className="px-3 py-1.5 text-end">{money(p.ownPaise)}</td>
                  <td className="px-3 py-1.5 text-end">{money(p.thirdPartyPaise)}</td>
                  <td className="px-3 py-1.5 text-end">{count(p.orders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="Gross merchandise value per day"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-slate-500"
                  fontSize={10}
                >
                  {moneyCompact(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const cx = PAD.left + band * i + band / 2;
              const own = p.ownPaise;
              const third = p.thirdPartyPaise;
              const ownTop = y(own);
              const thirdTop = y(own + third);
              const gap = own > 0 && third > 0 ? 2 : 0;
              const rounded = (x: number, top: number, bottom: number, roundTop: boolean) => {
                const h = Math.max(0, bottom - top);
                if (h <= 0) return '';
                const r = roundTop ? Math.min(4, h, barW / 2) : 0;
                return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${bottom}Z`;
              };
              return (
                <g key={p.day} opacity={hover === null || hover === i ? 1 : 0.45}>
                  <path
                    d={rounded(cx - barW / 2, ownTop, y(0), third === 0)}
                    fill={SERIES[0].color}
                  />
                  <path
                    d={rounded(cx - barW / 2, thirdTop, ownTop - gap, true)}
                    fill={SERIES[1].color}
                  />
                  {i % labelEvery === 0 && (
                    <text
                      x={cx}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      className="fill-slate-500"
                    >
                      {new Date(`${p.day}T00:00:00Z`).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </text>
                  )}
                  {/* Hit target: the whole column, wider than the bar. */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onTouchStart={() => setHover(i)}
                  />
                </g>
              );
            })}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(0)}
              y2={y(0)}
              stroke="#CBD5E1"
              strokeWidth={1}
            />
          </svg>
          {active && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
              style={{
                left: `clamp(0px, calc(${((PAD.left + band * (hover ?? 0) + band / 2) / W) * 100}% - 6rem), calc(100% - 12rem))`,
              }}
            >
              <p className="font-semibold text-navy">{date(active.day)}</p>
              <dl className="mt-1 space-y-0.5 tabular-nums">
                {SERIES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-slate-600">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-sm"
                        style={{ background: s.color }}
                      />
                      {s.label}
                    </dt>
                    <dd className="text-navy">{money(active[s.key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-1">
                  <dt className="text-slate-600">Orders</dt>
                  <dd className="text-navy">{count(active.orders)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
