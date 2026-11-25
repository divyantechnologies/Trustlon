'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, TextField } from '@/design-system';
import { useAuth } from '@/features/auth';
import { EmptyState, PageHeader, Panel } from '@/features/account/components/ui';
import { SectionError, SectionSkeleton } from '@/features/home/components/SectionStates';
import { pincodeError } from './query';
import { sellerApi, type SellerDelivery } from './seller-api';

function DeliveryForm({ seller }: { seller: SellerDelivery }) {
  const [address, setAddress] = useState(seller.pickupAddress ?? '');
  const [pincode, setPincode] = useState(seller.pickupPincode ?? '');
  const [sameDay, setSameDay] = useState(seller.sameDayDelivery);
  const [nextDay, setNextDay] = useState(seller.nextDayDelivery);
  const [cutoff, setCutoff] = useState(seller.deliveryCutoffTime ?? '');
  const [error, setError] = useState('');
  const [pinError, setPinError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Panel title={seller.displayName}>
      <form
        className="space-y-5"
        onChange={() => setSaved(false)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const invalid = pincodeError(pincode);
          setPinError(invalid);
          setError('');
          setSaved(false);
          if (invalid) return;
          setBusy(true);
          try {
            await sellerApi.save(seller.id, {
              pickupAddress: address.trim(),
              pickupPincode: pincode,
              sameDayDelivery: sameDay,
              nextDayDelivery: nextDay,
              deliveryCutoffTime: cutoff || null,
            });
            setSaved(true);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Could not save delivery settings. Please try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField
          label="Pickup address"
          value={address}
          required
          minLength={3}
          maxLength={240}
          disabled={busy}
          autoComplete="street-address"
          onChange={(event) => setAddress(event.target.value)}
        />
        <TextField
          label="Pickup pincode"
          value={pincode}
          required
          maxLength={6}
          inputMode="numeric"
          disabled={busy}
          error={pinError}
          hint="Pickup coordinates are resolved from the pincode when you save."
          onChange={(event) => {
            setPincode(event.target.value);
            setPinError(undefined);
          }}
        />
        <Checkbox
          label="Enable same-day delivery"
          checked={sameDay}
          disabled={busy}
          onChange={(event) => setSameDay(event.target.checked)}
        />
        <Checkbox
          label="Support next-day delivery after cutoff"
          checked={nextDay}
          disabled={busy}
          onChange={(event) => setNextDay(event.target.checked)}
        />
        <TextField
          label="Same-day order cutoff (optional, India time)"
          type="time"
          value={cutoff}
          disabled={busy}
          hint="Leave empty to offer same-day delivery throughout the day."
          onChange={(event) => setCutoff(event.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Delivery settings saved.</Alert>}
        <Button type="submit" loading={busy}>
          Save delivery settings
        </Button>
      </form>
    </Panel>
  );
}

export function SellerDeliveryPage() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<SellerDelivery[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (user?.role !== 'VENDOR_OWNER') return;
    const controller = new AbortController();
    setFailed(false);
    setSellers(null);
    sellerApi
      .list(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSellers(data.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [user?.id, user?.role, attempt]);
  if (user?.role !== 'VENDOR_OWNER')
    return <EmptyState title="Seller delivery settings are available to store owners." />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Seller delivery settings"
        description="Set your pickup location and local delivery availability. Only approved, active stores appear to shoppers."
      />
      {failed ? (
        <SectionError
          message="We could not load your stores."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : sellers === null ? (
        <SectionSkeleton cards={1} title={false} />
      ) : !sellers.length ? (
        <EmptyState title="No stores are linked to your account yet." />
      ) : (
        sellers.map((seller) => <DeliveryForm key={seller.id} seller={seller} />)
      )}
    </div>
  );
}
