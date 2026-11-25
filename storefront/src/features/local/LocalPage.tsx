'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, typography } from '@/design-system';
import { useAuth } from '@/features/auth';
import { accountApi } from '@/features/account/api';
import { homeApi } from '@/features/home/api';
import { CategoryNav } from '@/features/home/components/CategoryNav';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { SectionSkeleton } from '@/features/home/components/SectionStates';
import { useHome } from '@/features/home/home-provider';
import { readLocal } from '@/features/home/guest';
import { LocationBar } from './components/LocationBar';
import { DistanceFilter } from './components/DistanceFilter';
import { LocalSellerList } from './components/LocalSellerList';
import { ProductGrid } from './components/ProductGrid';
import { localUrl, parseRadius, pincodeError, PINCODE_KEY } from './query';

export function LocalPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useAuth();
  const { pincode: homePincode, setPincode } = useHome();
  const [editing, setEditing] = useState(false);
  const [initialError, setInitialError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pincode = params.get('pincode');
  const radius = parseRadius(params.get('radius'));
  const valid = pincode !== null && !pincodeError(pincode);

  useEffect(() => {
    if (pincode !== null) {
      if (!pincodeError(pincode)) setPincode(pincode);
      if (params.get('radius') !== String(radius))
        router.replace(localUrl(pincode, radius), { scroll: false });
      return;
    }
    if (status === 'loading') return;
    let cancelled = false;
    setInitialError(false);
    (async () => {
      const saved = readLocal<string | null>(PINCODE_KEY, null);
      let chosen = typeof saved === 'string' && !pincodeError(saved) ? saved : null;
      if (!chosen && status === 'authenticated') {
        const result = await accountApi.addresses();
        chosen =
          result.items.find((address) => address.isDefault && address.country === 'IN')?.pincode ??
          null;
      }
      if (!cancelled) router.replace(localUrl(chosen ?? homePincode, radius), { scroll: false });
    })().catch(() => {
      if (!cancelled) setInitialError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pincode, radius, status, params, router, setPincode, attempt, homePincode]);

  const savePincode = async (value: string) => {
    if (status === 'authenticated') {
      const [location, addresses] = await Promise.all([
        homeApi.serviceability(value),
        accountApi.addresses(),
      ]);
      const address = addresses.items.find((item) => item.isDefault && item.country === 'IN');
      if (address && location.serviceable && location.city && location.state) {
        await accountApi.updateAddress(address.id, {
          label: address.label,
          labelName: address.labelName ?? undefined,
          fullName: address.fullName,
          mobile: address.mobile,
          line1: address.line1,
          line2: address.line2 ?? undefined,
          landmark: address.landmark ?? undefined,
          country: address.country,
          isDefault: true,
          pincode: value,
          city: location.city,
          state: location.state,
        });
      }
    }
    router.push(localUrl(value, radius), { scroll: false });
  };

  return (
    <>
      <HomeHeader onChangeLocation={() => setEditing(true)} />
      <CategoryNav />
      <main className="mx-auto min-h-screen max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="space-y-3">
          <h1 className={typography.pageTitle}>Local sellers</h1>
          <p className="text-slate-500">
            Good things, closer to home. Shop nearby stores with same-day or next-day delivery.
          </p>
        </header>
        <div className="ds-card flex flex-wrap items-center justify-between gap-6">
          <LocationBar
            key={pincode ?? 'initial'}
            pincode={pincode ?? ''}
            open={editing}
            onOpenChange={setEditing}
            onSave={savePincode}
            signedIn={status === 'authenticated'}
          />
          <DistanceFilter
            value={radius}
            onChange={(value) =>
              router.push(localUrl(pincode ?? homePincode, value), { scroll: false })
            }
          />
        </div>
        {pincode === null ? (
          initialError ? (
            <Alert>
              We could not load your saved location.{' '}
              <Button variant="link" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </Button>
            </Alert>
          ) : (
            <SectionSkeleton />
          )
        ) : !valid ? (
          <Alert>{pincodeError(pincode)} Use Change to enter your delivery pincode.</Alert>
        ) : (
          <>
            <LocalSellerList
              key={`sellers:${pincode}:${radius}`}
              pincode={pincode}
              radius={radius}
              onRadiusChange={(value) => router.push(localUrl(pincode, value), { scroll: false })}
            />
            <ProductGrid
              key={`products:${pincode}:${radius}`}
              pincode={pincode}
              radius={radius}
              onRadiusChange={(value) => router.push(localUrl(pincode, value), { scroll: false })}
            />
          </>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
