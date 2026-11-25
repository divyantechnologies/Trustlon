'use client';
import { useState } from 'react';
import type { Product, ProductActions } from '../types';
import { historyWindow, money } from '../helpers';
import { button, field, Modal, secondary } from './primitives';
export function PriceHistoryChart({
  product,
  setAlert,
}: {
  product: Product;
  setAlert: ProductActions['setAlert'];
}) {
  const points = historyWindow(product);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(String(Math.round(product.price.current * 0.9)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!points.length) return null;
  const min = Math.min(...points.map((p) => p.price)),
    max = Math.max(...points.map((p) => p.price));
  const start = Date.parse(points[0].date),
    end = Date.parse(points[points.length - 1].date);
  const x = (date: string) => 25 + ((Date.parse(date) - start) / Math.max(1, end - start)) * 550;
  const y = (price: number) => (max === min ? 90 : 150 - ((price - min) / (max - min)) * 120);
  const line = points.map((p) => `${x(p.date)},${y(p.price)}`).join(' ');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Lowest recorded price in 90 days</p>
          <p className="mt-1 text-2xl font-semibold">{money(min)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Based on {points.length} recorded prices · Base product price
          </p>
        </div>
        <button className={secondary} onClick={() => setOpen(true)}>
          Set price alert
        </button>
      </div>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label={`Price history. Lowest ${money(min)}, highest ${money(max)}.`}
        className="mt-5 w-full"
      >
        <path d="M25 30H575M25 90H575M25 150H575" stroke="#e2e8f0" fill="none" />
        <polyline points={line} fill="none" stroke="#0f766e" strokeWidth="3" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.price)} r="4" fill="#0f766e">
            <title>{`${p.date}: ${money(p.price)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{points[0].date.slice(0, 10)}</span>
        <span>{points[points.length - 1].date.slice(0, 10)}</span>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-teal-700">View price data</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Recorded product prices</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Price</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="odd:bg-slate-50">
                <td className="p-2">{p.date.slice(0, 10)}</td>
                <td className="p-2">{money(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {open && (
        <Modal title="Set a price alert" onClose={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage('');
              try {
                await setAlert(product, Number(target));
                setMessage('Price alert saved to your account.');
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Please try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="text-sm">
              Notify me below (₹)
              <input
                className={`${field} mt-2`}
                type="number"
                required
                min="0.01"
                step="0.01"
                max={product.price.current || undefined}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <button className={`${button} mt-4`} disabled={busy}>
              Save alert
            </button>
            <p role="status" className="mt-3 text-sm">
              {message}
            </p>
          </form>
        </Modal>
      )}
    </>
  );
}
