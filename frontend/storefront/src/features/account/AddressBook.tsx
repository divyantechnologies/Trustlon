'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { formatInternational } from '@/lib/phone';
import { accountApi } from './api';
import { AddressForm } from './components/AddressForm';
import { EmptyState, PageHeader, secondaryAction, Skeleton } from './components/ui';
import { ADDRESS_LABELS } from './format';
import type { Address } from './types';

const MAX_ADDRESSES = 20;

function AddressCard({
  address,
  busy,
  onEdit,
  onRemove,
  onDefault,
}: {
  address: Address;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDefault: () => void;
}) {
  const title =
    address.label === 'OTHER' && address.labelName
      ? address.labelName
      : ADDRESS_LABELS[address.label];
  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-navy">
          <Icon name="pin" className="h-4 w-4 text-teal-600" />
          {title}
        </p>
        {address.isDefault && (
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
            Default
          </span>
        )}
      </div>
      <address className="mt-3 flex-1 text-sm not-italic leading-6 text-navy">
        <span className="font-medium">{address.fullName}</span>
        <br />
        {address.line1}
        {address.line2 && <>, {address.line2}</>}
        {address.landmark && (
          <>
            <br />
            {address.landmark}
          </>
        )}
        <br />
        {address.city}, {address.state} {address.pincode}
        <br />
        <span className="text-slate-500">Mobile {formatInternational(address.mobile)}</span>
      </address>
      <p className="mt-3 text-xs text-slate-500">
        {address.delivery.serviceable
          ? `Delivery in ${address.delivery.estimatedDeliveryDays ?? 'a few'} days${
              address.delivery.codAvailable ? ' · Cash on delivery available' : ''
            }`
          : 'Delivery to this pincode is confirmed at checkout'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="button" className={secondaryAction} onClick={onEdit} disabled={busy}>
          Edit
        </button>
        <button type="button" className={secondaryAction} onClick={onRemove} disabled={busy}>
          Remove
        </button>
        {!address.isDefault && (
          <button type="button" className={secondaryAction} onClick={onDefault} disabled={busy}>
            Set as default
          </button>
        )}
      </div>
    </article>
  );
}

/** /account/addresses (spec 3.5). */
export function AddressBook() {
  const [items, setItems] = useState<Address[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<Address | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFailed(false);
    accountApi
      .addresses()
      .then((result) => setItems(result.items))
      .catch(() => setFailed(true));
  }, [attempt]);

  const run = async (id: string, action: () => Promise<{ items: Address[] }>, success: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      setItems((await action()).items);
      setNotice({ tone: 'success', text: success });
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          error instanceof ApiError && error.message
            ? error.message
            : 'Something went wrong. Try again.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openForm = (address: Address | null) => {
    setNotice(null);
    setEditing(address);
    setFormOpen(true);
  };

  const full = (items?.length ?? 0) >= MAX_ADDRESSES;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved addresses"
        description="Addresses for delivery and return pickups. City and state fill in from the pincode."
        action={
          items &&
          items.length > 0 && (
            <div className="w-full sm:w-48">
              <Button onClick={() => openForm(null)} disabled={full}>
                <Icon name="plus" className="h-4 w-4" />
                Add address
              </Button>
            </div>
          )
        }
      />

      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
      {full && (
        <Alert tone="info">
          You have saved {MAX_ADDRESSES} addresses, the most allowed. Remove one to add another.
        </Alert>
      )}

      {failed && !items ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your addresses"
          action={
            <div className="w-40">
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          }
        />
      ) : !items ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No saved addresses yet"
          description="Save your home or office address for faster checkout and easy return pickups."
          action={
            <div className="w-48">
              <Button onClick={() => openForm(null)}>
                <Icon name="plus" className="h-4 w-4" />
                Add address
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              busy={busyId === address.id}
              onEdit={() => openForm(address)}
              onRemove={() => setRemoving(address)}
              onDefault={() =>
                run(
                  address.id,
                  () => accountApi.setDefaultAddress(address.id),
                  'Default address updated.',
                )
              }
            />
          ))}
        </div>
      )}

      <AddressForm
        open={formOpen}
        address={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(next) => {
          setItems(next);
          setFormOpen(false);
          setNotice({ tone: 'success', text: editing ? 'Address updated.' : 'Address saved.' });
        }}
      />

      <Dialog open={Boolean(removing)} title="Remove address?" onClose={() => setRemoving(null)}>
        {removing && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              {removing.line1}, {removing.city} {removing.pincode} will be removed from your address
              book. Past orders keep their delivery address.
              {removing.isDefault && ' Your most recently used address becomes the default.'}
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Keep address
              </Button>
              <Button
                variant="destructive"
                loading={busyId === removing.id}
                onClick={async () => {
                  const target = removing;
                  await run(
                    target.id,
                    () => accountApi.removeAddress(target.id),
                    'Address removed.',
                  );
                  setRemoving(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
