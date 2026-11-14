'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, cn, focusRing, inputClass } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import { AddressForm } from './components/AddressForm';
import { EmptyState, PageHeader, Panel, Skeleton, Thumb } from './components/ui';
import { ADDRESS_LABELS, formatDate, formatMoney } from './format';
import type { Address, ReturnEligibility, ReturnReason, ReturnRefundMethod } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface Photo {
  key: string;
  preview: string;
  id: string | null;
  error: string | null;
}

const optionClass = (selected: boolean) =>
  cn(
    'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal',
    selected ? 'border-teal bg-teal-50/40' : 'border-slate-200 bg-white hover:border-slate-300',
  );

/** /account/returns/new?subOrder=:id (spec 3.3): choose items, reason, photos, pickup and refund. */
export function ReturnRequestForm() {
  const params = useSearchParams();
  const router = useRouter();
  const subOrderId = params.get('subOrder') ?? '';
  const commentsId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [eligibility, setEligibility] = useState<ReturnEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [comments, setComments] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pickup, setPickup] = useState<string>('order');
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!UUID.test(subOrderId)) {
      setLoadError('Open a delivered order and choose Return items to start a return.');
      return;
    }
    const controller = new AbortController();
    accountApi
      .returnEligibility(subOrderId, controller.signal)
      .then((data) => {
        setEligibility(data);
        const returnable = data.items.filter((item) => item.returnableQuantity > 0);
        if (returnable.length === 1)
          setQuantities({ [returnable[0].orderItemId]: returnable[0].returnableQuantity });
        setRefundMethod(data.refundMethods[0]?.method ?? null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof ApiError && caught.status === 404
            ? 'We couldn’t find this order.'
            : 'We couldn’t load this order. Check your connection and try again.',
        );
      });
    accountApi
      .addresses()
      .then((result) => setAddresses(result.items))
      .catch(() => setAddresses([]));
    return () => controller.abort();
  }, [subOrderId]);

  // Free the local previews when leaving the page.
  const previews = useRef<string[]>([]);
  previews.current = photos.map((photo) => photo.preview);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Return items" />
        <EmptyState
          title={loadError}
          action={
            <Link
              href="/account/orders?status=delivered"
              className="font-semibold text-teal-600 hover:underline"
            >
              See delivered orders
            </Link>
          }
        />
      </div>
    );
  }

  if (!eligibility) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const back = (
    <Link
      href={`/account/orders/${eligibility.order.id}`}
      className="inline-flex min-h-11 items-center text-sm text-teal-600"
    >
      ← Back to order #{eligibility.order.orderNumber}
    </Link>
  );

  if (!eligibility.eligible) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          title="These items can’t be returned"
          description={eligibility.reason ?? undefined}
        />
      </div>
    );
  }

  const selected = eligibility.items.filter((item) => (quantities[item.orderItemId] ?? 0) > 0);
  const refundTotal = selected.reduce(
    (sum, item) => sum + item.unitPricePaise * quantities[item.orderItemId],
    0,
  );
  const reasonInfo = eligibility.reasons.find((option) => option.value === reason);
  const uploading = photos.some((photo) => !photo.id && !photo.error);
  const readyPhotos = photos.filter((photo) => photo.id);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = eligibility.maxPhotos - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`You can add up to ${eligibility.maxPhotos} photos.`);
    for (const file of chosen) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const photo: Photo = { key, preview: URL.createObjectURL(file), id: null, error: null };
      if (!ACCEPTED.includes(file.type)) photo.error = 'Use a JPG, PNG or WebP photo';
      else if (file.size > MAX_PHOTO_BYTES) photo.error = 'Photos must be 5 MB or smaller';
      setPhotos((current) => [...current, photo]);
      if (photo.error) continue;
      try {
        const { id } = await accountApi.uploadReturnPhoto(file);
        setPhotos((current) => current.map((p) => (p.key === key ? { ...p, id } : p)));
      } catch (caught) {
        const message =
          caught instanceof ApiError && caught.message
            ? caught.message
            : 'Upload failed. Try again.';
        setPhotos((current) => current.map((p) => (p.key === key ? { ...p, error: message } : p)));
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (key: string) =>
    setPhotos((current) => {
      const photo = current.find((p) => p.key === key);
      if (photo) URL.revokeObjectURL(photo.preview);
      return current.filter((p) => p.key !== key);
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (selected.length === 0) return setError('Choose at least one item to return.');
    if (!reason) return setError('Choose a reason for the return.');
    if (reasonInfo?.photoRequired && readyPhotos.length === 0) {
      return setError('Add at least one photo that shows the problem.');
    }
    if (uploading) return setError('Wait for your photos to finish uploading.');
    if (!refundMethod) return setError('Choose where you want your refund.');

    setSubmitting(true);
    try {
      const created = await accountApi.createReturn({
        subOrderId: eligibility.subOrderId,
        items: selected.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: quantities[item.orderItemId],
        })),
        reason,
        comments: comments.trim() || undefined,
        photoIds: readyPhotos.map((photo) => photo.id as string),
        pickupAddressId: pickup === 'order' ? undefined : pickup,
        refundMethod,
      });
      router.push(`/account/returns/${created.id}?created=1`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t submit your return. Try again.',
      );
      setSubmitting(false);
    }
  };

  const orderAddress = eligibility.orderAddress;

  return (
    <>
      <form onSubmit={submit} noValidate className="space-y-6">
        {back}
        <PageHeader
          title="Return items"
          description={`From ${eligibility.seller.name} · return by ${
            eligibility.returnEligibleUntil
              ? formatDate(eligibility.returnEligibleUntil)
              : 'the end of the return window'
          }`}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Panel title="1. Which items are you returning?">
              <ul className="space-y-3">
                {eligibility.items.map((item) => {
                  const quantity = quantities[item.orderItemId] ?? 0;
                  const disabled = item.returnableQuantity === 0;
                  return (
                    <li
                      key={item.orderItemId}
                      className={cn(optionClass(quantity > 0), disabled && 'opacity-60')}
                    >
                      <input
                        type="checkbox"
                        id={`item-${item.orderItemId}`}
                        checked={quantity > 0}
                        disabled={disabled}
                        onChange={(e) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.orderItemId]: e.target.checked ? item.returnableQuantity : 0,
                          }))
                        }
                        className="mt-1 h-4 w-4 accent-teal"
                      />
                      <Thumb src={item.image} alt="" className="h-16 w-16" />
                      <label
                        htmlFor={`item-${item.orderItemId}`}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        {item.brand && (
                          <span className="block text-xs uppercase tracking-wider text-slate-500">
                            {item.brand}
                          </span>
                        )}
                        <span className="block font-medium text-navy">{item.name}</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {disabled
                            ? 'Already in a return'
                            : `${formatMoney(item.unitPricePaise)} each · ordered ${item.orderedQuantity}`}
                        </span>
                      </label>
                      {quantity > 0 && item.returnableQuantity > 1 && (
                        <select
                          aria-label={`Quantity of ${item.name} to return`}
                          value={quantity}
                          onChange={(e) =>
                            setQuantities((current) => ({
                              ...current,
                              [item.orderItemId]: Number(e.target.value),
                            }))
                          }
                          className={cn(inputClass(false), 'w-20')}
                        >
                          {Array.from({ length: item.returnableQuantity }, (_, i) => i + 1).map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title="2. Why are you returning them?">
              <fieldset>
                <legend className="sr-only">Reason</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {eligibility.reasons.map((option) => (
                    <label key={option.value} className={optionClass(reason === option.value)}>
                      <input
                        type="radio"
                        name="return-reason"
                        value={option.value}
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        className="mt-0.5 h-4 w-4 accent-teal"
                      />
                      <span className="text-sm text-navy">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4">
                <label htmlFor={commentsId} className="mb-1.5 block text-sm font-medium text-navy">
                  Tell us more <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id={commentsId}
                  rows={3}
                  maxLength={500}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className={`${inputClass(false)} h-auto py-2`}
                />
                <p className="mt-1 text-right text-xs text-slate-500">{comments.length}/500</p>
              </div>
            </Panel>

            <Panel title={`3. Photos ${reasonInfo?.photoRequired ? '(required)' : '(optional)'}`}>
              <p className="mb-4 text-sm text-slate-500">
                {reasonInfo?.photoRequired
                  ? 'Add at least one clear photo of the problem so the seller can approve your return quickly.'
                  : 'Photos help the seller approve your return faster.'}{' '}
                Up to {eligibility.maxPhotos} photos, JPG, PNG or WebP, 5 MB each.
              </p>
              <ul className="flex flex-wrap gap-3">
                {photos.map((photo) => (
                  <li key={photo.key} className="relative">
                    <img
                      src={photo.preview}
                      alt="Return photo"
                      className={cn(
                        'h-24 w-24 rounded-lg border object-cover',
                        photo.error ? 'border-red-300 opacity-50' : 'border-slate-200',
                      )}
                    />
                    {!photo.id && !photo.error && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-xs text-navy">
                        Uploading…
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.key)}
                      aria-label="Remove photo"
                      className={cn(
                        'absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-navy shadow-sm',
                        focusRing,
                      )}
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                    {photo.error && (
                      <p className="mt-1 w-24 text-[11px] leading-tight text-red-600">
                        {photo.error}
                      </p>
                    )}
                  </li>
                ))}
                {photos.length < eligibility.maxPhotos && (
                  <li>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className={cn(
                        'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-teal hover:text-teal-600',
                        focusRing,
                      )}
                    >
                      <Icon name="plus" className="h-5 w-5" />
                      Add photo
                    </button>
                  </li>
                )}
              </ul>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED.join(',')}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => void addFiles(e.target.files)}
              />
            </Panel>

            <Panel
              title="4. Pickup address"
              action={
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  className="text-sm font-semibold text-teal-600 hover:underline"
                >
                  Add address
                </button>
              }
            >
              <fieldset>
                <legend className="sr-only">Pickup address</legend>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className={optionClass(pickup === 'order')}>
                    <input
                      type="radio"
                      name="pickup"
                      checked={pickup === 'order'}
                      onChange={() => setPickup('order')}
                      className="mt-0.5 h-4 w-4 accent-teal"
                    />
                    <span className="text-sm text-navy">
                      <span className="block font-semibold">Delivery address of this order</span>
                      {orderAddress.name}, {orderAddress.line1}, {orderAddress.city}{' '}
                      {orderAddress.pincode}
                    </span>
                  </label>
                  {addresses.map((address) => (
                    <label key={address.id} className={optionClass(pickup === address.id)}>
                      <input
                        type="radio"
                        name="pickup"
                        checked={pickup === address.id}
                        onChange={() => setPickup(address.id)}
                        className="mt-0.5 h-4 w-4 accent-teal"
                      />
                      <span className="text-sm text-navy">
                        <span className="block font-semibold">
                          {address.label === 'OTHER' && address.labelName
                            ? address.labelName
                            : ADDRESS_LABELS[address.label]}
                          {address.isDefault ? ' · Default' : ''}
                        </span>
                        {address.fullName}, {address.line1}, {address.city} {address.pincode}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Panel>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Panel title="Refund">
              <fieldset>
                <legend className="mb-2 text-sm text-slate-500">Where should the money go?</legend>
                <div className="space-y-2">
                  {eligibility.refundMethods.map((option) => (
                    <label
                      key={option.method}
                      className={optionClass(refundMethod === option.method)}
                    >
                      <input
                        type="radio"
                        name="refund-method"
                        checked={refundMethod === option.method}
                        onChange={() => setRefundMethod(option.method)}
                        className="mt-0.5 h-4 w-4 accent-teal"
                      />
                      <span className="text-sm text-navy">
                        <span className="block font-semibold">
                          {option.method === 'WALLET'
                            ? 'Trustlon wallet'
                            : 'Original payment method'}
                        </span>
                        {option.method === 'WALLET'
                          ? 'Credited as soon as the refund is issued'
                          : 'Usually 5 to 7 business days after the refund is issued'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Items selected</dt>
                  <dd className="text-navy">
                    {selected.reduce((sum, item) => sum + quantities[item.orderItemId], 0)}
                  </dd>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <dt className="text-navy">Refund amount</dt>
                  <dd className="text-navy">{formatMoney(refundTotal)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-500">
                The refund starts after the seller receives and checks the items. Delivery charges
                are not refunded.
              </p>
              {error && (
                <div className="mt-4">
                  <Alert>{error}</Alert>
                </div>
              )}
              <div className="mt-4">
                <Button type="submit" loading={submitting} disabled={uploading}>
                  Submit return request
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </form>

      <AddressForm
        open={addingAddress}
        address={null}
        onClose={() => setAddingAddress(false)}
        onSaved={(items) => {
          setAddresses(items);
          setAddingAddress(false);
          const newest = items.find(
            (item) => !addresses.some((existing) => existing.id === item.id),
          );
          if (newest) setPickup(newest.id);
        }}
      />
    </>
  );
}
