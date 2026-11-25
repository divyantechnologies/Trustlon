'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, TextField, inputClass } from '@/design-system';
import type { CategoryRef, Store } from '../home/types';
import { priceToPaise, type CategoryQuery } from './query';

/** The same fields serve the debounced sidebar and the explicit-apply mobile drawer. */
export function CategoryFilters({
  query,
  stores,
  onApply,
  mobile = false,
  categories,
  availability = false,
}: {
  query: CategoryQuery;
  stores: Store[];
  onApply: (query: CategoryQuery) => void;
  mobile?: boolean;
  categories?: CategoryRef[];
  availability?: boolean;
}) {
  const [minimum, setMinimum] = useState(
    query.minPricePaise === undefined ? '' : String(query.minPricePaise / 100),
  );
  const [maximum, setMaximum] = useState(
    query.maxPricePaise === undefined ? '' : String(query.maxPricePaise / 100),
  );
  const [store, setStore] = useState(query.store ?? '');
  const [category, setCategory] = useState(query.category ?? '');
  const [inStock, setInStock] = useState(query.inStock ?? false);
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const minPricePaise = priceToPaise(minimum);
  const maxPricePaise = priceToPaise(maximum);
  const invalidMinimum = Number.isNaN(minPricePaise);
  const invalidMaximum = Number.isNaN(maxPricePaise);
  const inverted =
    minPricePaise !== undefined && maxPricePaise !== undefined && minPricePaise > maxPricePaise;
  const invalid = invalidMinimum || invalidMaximum || inverted;
  const changed =
    minPricePaise !== query.minPricePaise ||
    maxPricePaise !== query.maxPricePaise ||
    (store || undefined) !== query.store ||
    (category || undefined) !== query.category ||
    (inStock || undefined) !== query.inStock;

  // Follow URL navigation without remounting fields (and losing typing focus).
  useEffect(() => {
    setMinimum(query.minPricePaise === undefined ? '' : String(query.minPricePaise / 100));
    setMaximum(query.maxPricePaise === undefined ? '' : String(query.maxPricePaise / 100));
    setStore(query.store ?? '');
    setCategory(query.category ?? '');
    setInStock(query.inStock ?? false);
  }, [
    query.minPricePaise,
    query.maxPricePaise,
    query.store,
    query.sort,
    query.category,
    query.inStock,
  ]);

  useEffect(() => {
    if (mobile || invalid || !changed) return;
    const timer = window.setTimeout(() => {
      applyRef.current({
        ...query,
        minPricePaise,
        maxPricePaise,
        store: store || undefined,
        category: category || undefined,
        inStock: inStock || undefined,
        page: 1,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [mobile, invalid, changed, minPricePaise, maxPricePaise, store, category, inStock, query]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid)
          onApply({
            ...query,
            minPricePaise,
            maxPricePaise,
            store: store || undefined,
            category: category || undefined,
            inStock: inStock || undefined,
            page: 1,
          });
      }}
    >
      {categories && (
        <label className="block space-y-2">
          <span className="font-semibold">Category</span>
          <select
            className={inputClass(false)}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {category && !categories.some((item) => item.slug === category) && (
              <option value={category}>{category}</option>
            )}
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="space-y-4">
        <legend className="mb-3 font-semibold">Price range</legend>
        <TextField
          label="Minimum price (₹)"
          inputMode="decimal"
          value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
          error={
            invalidMinimum ? 'Enter a non-negative price with up to two decimal places.' : undefined
          }
        />
        <TextField
          label="Maximum price (₹)"
          inputMode="decimal"
          value={maximum}
          onChange={(event) => setMaximum(event.target.value)}
          error={
            invalidMaximum
              ? 'Enter a non-negative price with up to two decimal places.'
              : inverted
                ? 'Maximum price must be at least the minimum price.'
                : undefined
          }
        />
        <p className="text-xs text-slate-500">Prices before limited-time offers.</p>
      </fieldset>
      <label className="block space-y-2">
        <span className="font-semibold">Vendor</span>
        <select
          className={inputClass(false)}
          value={store}
          onChange={(event) => setStore(event.target.value)}
        >
          <option value="">All vendors</option>
          {store && !stores.some((item) => item.slug === store) && (
            <option value={store}>{store}</option>
          )}
          {stores.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="block text-xs text-slate-500">Choose one of our verified stores.</span>
      </label>
      {availability && (
        <Checkbox
          label="In stock only"
          checked={inStock}
          onChange={(event) => setInStock(event.target.checked)}
        />
      )}
      {mobile && (
        <Button type="submit" disabled={invalid}>
          Apply filters
        </Button>
      )}
      <Button
        type="button"
        variant="link"
        onClick={() => {
          setMinimum('');
          setMaximum('');
          setStore('');
          setCategory('');
          setInStock(false);
          if (!mobile) onApply({ sort: query.sort, page: 1 });
        }}
      >
        Clear all filters
      </Button>
    </form>
  );
}
