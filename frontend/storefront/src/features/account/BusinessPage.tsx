'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, cn, TextField } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import { EmptyState, PageHeader, Panel, Skeleton } from './components/ui';
import { formatDate } from './format';
import { CityField, PincodeField, StateField } from '@/components/location';
import type { BusinessProfile, BusinessProfileInput, GstinCheck } from './types';

type Errors = Partial<Record<keyof BusinessProfileInput, string>>;

const EMPTY: BusinessProfileInput = {
  businessName: '',
  gstin: '',
  pan: '',
  billingLine1: '',
  billingLine2: '',
  billingCity: '',
  billingState: '',
  billingPincode: '',
};

const STATUS = {
  PENDING: {
    title: 'Verification pending',
    text: 'We are checking your GSTIN. Bulk pricing switches on as soon as it is verified.',
    tone: 'border-navy/10 bg-navy-50 text-navy',
  },
  VERIFIED: {
    title: 'Verified business buyer',
    text: 'Bulk pricing is on, and invoices for your orders carry your GSTIN for input tax credit.',
    tone: 'border-teal/30 bg-teal-50 text-teal-600',
  },
  REJECTED: {
    title: 'Verification failed',
    text: 'Please correct the details below and submit again.',
    tone: 'border-red-200 bg-red-50 text-red-600',
  },
} as const;

function fromProfile(profile: BusinessProfile): BusinessProfileInput {
  return {
    businessName: profile.businessName,
    gstin: profile.gstin,
    pan: profile.pan,
    billingLine1: profile.billing.line1,
    billingLine2: profile.billing.line2 ?? '',
    billingCity: profile.billing.city,
    billingState: profile.billing.state,
    billingPincode: profile.billing.pincode,
  };
}

/** /account/b2b (spec 3.8). */
export function BusinessPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [tiers, setTiers] = useState<Array<{ minQuantity: number; label: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [values, setValues] = useState<BusinessProfileInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [gstinCheck, setGstinCheck] = useState<GstinCheck | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    accountApi
      .business()
      .then((result) => {
        setProfile(result.profile);
        setTiers(result.tiers);
        if (result.profile) setValues(fromProfile(result.profile));
        setLoaded(true);
      })
      .catch(() => setFailed(true));
  }, []);

  // Check the GSTIN once it is complete, and fill in the PAN and state it contains.
  useEffect(() => {
    const gstin = values.gstin.trim().toUpperCase();
    if (gstin.length !== 15) {
      setGstinCheck(null);
      return;
    }
    let active = true;
    accountApi
      .checkGstin(gstin)
      .then((check) => {
        if (!active) return;
        setGstinCheck(check);
        if (check.valid) {
          setValues((current) => ({
            ...current,
            pan: check.pan ?? current.pan,
            billingState: check.state ?? current.billingState,
          }));
        }
      })
      .catch(() => active && setGstinCheck(null));
    return () => {
      active = false;
    };
  }, [values.gstin]);

  const set = (key: keyof BusinessProfileInput, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    if (values.businessName.trim().length < 2)
      found.businessName = 'Enter the registered business name';
    if (values.gstin.trim().length !== 15 || gstinCheck?.valid === false) {
      found.gstin = gstinCheck?.reason ?? 'Enter your 15-character GSTIN';
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(values.pan.trim().toUpperCase()))
      found.pan = 'A PAN has 10 characters, e.g. ABCDE1234F';
    if (values.billingLine1.trim().length < 3) found.billingLine1 = 'Enter the building and street';
    if (values.billingCity.trim().length < 2) found.billingCity = 'Enter the city';
    if (!values.billingState) found.billingState = 'Choose a state';
    if (!/^[1-9]\d{5}$/.test(values.billingPincode.trim()))
      found.billingPincode = 'Enter a valid six-digit pincode';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setNotice(null);
    try {
      const saved = await accountApi.saveBusiness({
        ...values,
        gstin: values.gstin.trim().toUpperCase(),
        pan: values.pan.trim().toUpperCase(),
        billingLine2: values.billingLine2?.trim() || undefined,
      });
      setProfile(saved);
      setNotice({
        tone: 'success',
        text:
          saved.status === 'VERIFIED'
            ? 'Your business details are saved.'
            : 'Submitted. We will verify your GSTIN and update this page.',
      });
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY) {
        setErrors({ [error.field]: error.message } as Errors);
      } else {
        setNotice({
          tone: 'error',
          text:
            error instanceof ApiError && error.message
              ? error.message
              : 'We couldn’t save your details. Try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (failed)
    return (
      <EmptyState
        role="alert"
        title="We couldn’t load your business profile"
        description="Refresh the page to try again."
      />
    );
  if (!loaded) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const status = profile ? STATUS[profile.status] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business buying (B2B)"
        description="Register your GSTIN to buy at bulk prices and get GST invoices you can claim input tax credit on."
      />
      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>

      {profile && status && (
        <div className={cn('flex gap-3 rounded-lg border p-4', status.tone)} role="status">
          <Icon
            name={
              profile.status === 'VERIFIED'
                ? 'check'
                : profile.status === 'REJECTED'
                  ? 'close'
                  : 'shield'
            }
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <div className="text-sm">
            <p className="font-semibold">{status.title}</p>
            <p className="mt-0.5">
              {status.text}
              {profile.status === 'REJECTED' && profile.rejectionReason
                ? ` Reason: ${profile.rejectionReason}`
                : ''}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {profile.status === 'VERIFIED' && profile.verifiedAt
                ? `Verified on ${formatDate(profile.verifiedAt)}`
                : `Submitted on ${formatDate(profile.submittedAt)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Business details">
          <form onSubmit={submit} noValidate className="space-y-4">
            <TextField
              label="Registered business name"
              maxLength={150}
              value={values.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              error={errors.businessName}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="GSTIN"
                maxLength={15}
                autoCapitalize="characters"
                placeholder="e.g. 29ABCDE1234F1Z5"
                value={values.gstin}
                onChange={(e) =>
                  set('gstin', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))
                }
                error={
                  errors.gstin ??
                  (gstinCheck && !gstinCheck.valid ? (gstinCheck.reason ?? undefined) : undefined)
                }
                hint={
                  gstinCheck?.valid
                    ? `Valid format · registered in ${gstinCheck.state}`
                    : 'We fill in the PAN and state from it'
                }
              />
              <TextField
                label="PAN"
                maxLength={10}
                autoCapitalize="characters"
                value={values.pan}
                onChange={(e) => set('pan', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                error={errors.pan}
              />
            </div>
            <p className="pt-2 text-sm font-semibold text-navy">
              Billing address (as on your GST registration)
            </p>
            <TextField
              label="Building and street"
              maxLength={120}
              value={values.billingLine1}
              onChange={(e) => set('billingLine1', e.target.value)}
              error={errors.billingLine1}
            />
            <TextField
              label="Area or locality (optional)"
              maxLength={120}
              value={values.billingLine2 ?? ''}
              onChange={(e) => set('billingLine2', e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PincodeField
                value={values.billingPincode}
                error={errors.billingPincode}
                onChange={(text) => set('billingPincode', text)}
                onResolved={(place) => {
                  if (!place) return;
                  setValues((current) => ({
                    ...current,
                    billingPincode: place.pincode,
                    billingCity: place.city,
                    billingState: place.state,
                  }));
                }}
              />
              <CityField
                country="IN"
                value={values.billingCity}
                onChange={(city) => set('billingCity', city)}
                error={errors.billingCity}
              />
              <StateField
                country="IN"
                value={values.billingState}
                onChange={(state) => set('billingState', state)}
                error={errors.billingState}
              />
            </div>
            <div className="pt-2 sm:w-64">
              <Button type="submit" loading={saving}>
                {profile ? 'Save and resubmit' : 'Submit for verification'}
              </Button>
            </div>
            {profile?.status === 'VERIFIED' && (
              <p className="text-xs text-slate-500">
                Changing the GSTIN, PAN or business name sends your profile for verification again.
              </p>
            )}
          </form>
        </Panel>

        <Panel title="Bulk pricing">
          <p className="text-sm text-slate-600">
            Verified business buyers see a lower price per unit when they order more. Each seller
            sets its own price for every tier.
          </p>
          <ul className="mt-4 space-y-2">
            {tiers.map((tier) => (
              <li
                key={tier.minQuantity}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="text-navy">{tier.label}</span>
                <span className={profile?.bulkPricingEnabled ? 'text-teal-600' : 'text-slate-400'}>
                  {profile?.bulkPricingEnabled ? 'Available' : 'After verification'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Tax invoices for your business orders include your GSTIN, so you can claim input tax
            credit.
          </p>
        </Panel>
      </div>
    </div>
  );
}
