'use client';
import { useState } from 'react';
import type { Product } from '../types';
import { Modal, secondary } from './primitives';
const labels = {
  bank: 'Bank',
  coupon: 'Coupons',
  cashback: 'Cashback',
  emi: 'EMI',
  coins: 'Coins',
  other: 'Other',
};
export function OffersTabs({ offers = [] }: { offers?: Product['offers'] }) {
  const tabs = Object.keys(labels).filter((type) =>
    offers.some((o) => o.type === type),
  ) as (keyof typeof labels)[];
  const [tab, setTab] = useState(tabs[0]);
  const [all, setAll] = useState(false);
  const [terms, setTerms] = useState<string>();
  const [notice, setNotice] = useState('');
  if (!offers.length) return null;
  return (
    <>
      <div role="tablist" aria-label="Offer types" className="mb-5 flex gap-2 overflow-auto">
        {tabs.map((t, i) => (
          <button
            key={t}
            id={`offer-tab-${t}`}
            aria-controls="offer-panel"
            role="tab"
            aria-selected={tab === t && !all}
            tabIndex={tab === t ? 0 : -1}
            className={`${secondary} ${tab === t && !all ? '!border-teal-600 !bg-teal-50' : ''}`}
            onClick={() => {
              setTab(t);
              setAll(false);
            }}
            onKeyDown={(e) => {
              if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const n =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setTab(tabs[n]);
              setAll(false);
              document.getElementById(`offer-tab-${tabs[n]}`)?.focus();
            }}
          >
            {labels[t]}
          </button>
        ))}
      </div>
      <div
        id="offer-panel"
        role={all ? 'region' : 'tabpanel'}
        aria-label={all ? 'All offers' : labels[tab]}
        className="grid gap-3 sm:grid-cols-2"
      >
        {offers
          .filter((o) => all || o.type === tab)
          .map((o, i) => (
            <article
              key={i}
              className="rounded-xl border border-dashed border-teal-200 bg-teal-50/40 p-4"
            >
              <h3 className="font-semibold">{o.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{o.description}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {o.code && (
                  <button
                    className={secondary}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(o.code!);
                        setNotice('Code copied.');
                      } catch {
                        setNotice(`Copy this code: ${o.code}`);
                      }
                    }}
                  >
                    Copy {o.code}
                  </button>
                )}
                {o.terms && (
                  <button
                    className="min-h-11 text-sm text-teal-700 underline"
                    onClick={() => setTerms(o.terms)}
                  >
                    T&amp;C
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
      {tabs.length > 1 && (
        <button
          className="mt-3 min-h-11 font-medium text-teal-700"
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'Show selected offers' : 'View all offers'}
        </button>
      )}
      <p role="status" className="text-sm text-teal-700">
        {notice}
      </p>
      {terms && (
        <Modal title="Offer terms" onClose={() => setTerms(undefined)}>
          <p className="whitespace-pre-line leading-7">{terms}</p>
        </Modal>
      )}
    </>
  );
}
