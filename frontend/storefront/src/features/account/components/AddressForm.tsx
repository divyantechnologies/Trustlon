'use client';
import { useEffect, useState } from 'react';
import {
  CityField,
  CountrySelect,
  PincodeField,
  StateField,
  useCountries,
} from '@/components/location';
import { Alert, Button, cn, Dialog, MobileField, TextField } from '@/design-system';
import { homeApi } from '@/features/home/api';
import { ApiError } from '@/lib/http';
import { useSiteConfig } from '@/lib/site-config';
import { postalCodeValid, type CountryInfo } from '@/lib/location';
import { isCountryCode, splitE164, type CountryCode } from '@/lib/phone';
import { isValidName, PINCODE_PATTERN, toMobileE164 } from '@/lib/validation';
import { accountApi } from '../api';
import { ADDRESS_LABELS } from '../format';
import type { Address, AddressInput, AddressLabel } from '../types';

type Errors = Partial<Record<keyof AddressInput, string>>;

const EMPTY: AddressInput = {
  label: 'HOME',
  labelName: '',
  fullName: '',
  mobile: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  country: 'IN',
  city: '',
  state: '',
  isDefault: false,
};

function fromAddress(address: Address): AddressInput {
  return {
    label: address.label,
    labelName: address.labelName ?? '',
    fullName: address.fullName,
    mobile: splitE164(address.mobile).national,
    line1: address.line1,
    line2: address.line2 ?? '',
    landmark: address.landmark ?? '',
    pincode: address.pincode,
    country: address.country ?? 'IN',
    city: address.city,
    state: address.state,
    isDefault: address.isDefault,
  };
}

function validate(
  values: AddressInput,
  country: CountryInfo | undefined,
  phoneCountry: string,
): Errors {
  const errors: Errors = {};
  const india = values.country === 'IN';
  if (!isValidName(values.fullName)) {
    errors.fullName = 'Enter the receiver’s full name (letters only)';
  }
  if (!toMobileE164(values.mobile, phoneCountry)) {
    errors.mobile = india
      ? 'Enter a valid 10-digit Indian mobile number'
      : 'Enter a valid phone number for the selected country';
  }
  if (values.line1.trim().length < 3) errors.line1 = 'Enter the house number and street';
  if (
    india ? !PINCODE_PATTERN.test(values.pincode.trim()) : !postalCodeValid(country, values.pincode)
  ) {
    errors.pincode = india
      ? 'Enter a valid six-digit pincode'
      : `Enter a valid ${(country?.postalLabel ?? 'postal code').toLowerCase()}${country?.postalExample ? `, e.g. ${country.postalExample}` : ''}`;
  }
  if (values.city.trim().length < 2) errors.city = 'Enter the city or town';
  if (!values.state && (country?.stateRequired ?? india)) errors.state = 'Choose a state';
  if (values.label === 'OTHER' && (values.labelName ?? '').trim().length < 2) {
    errors.labelName = 'Give this address a name, e.g. Parents’ home';
  }
  return errors;
}

/** Add or edit an address. City and state fill in from the pincode when it is known. */
export function AddressForm({
  open,
  address,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to add a new address. */
  address: Address | null;
  onClose: () => void;
  onSaved: (items: Address[]) => void;
}) {
  const countries = useCountries();
  // Admin › Settings › Features can turn off addresses outside India.
  const internationalAllowed = useSiteConfig().config.features.internationalAddresses;
  const [values, setValues] = useState<AddressInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pincodeNote, setPincodeNote] = useState<string | null>(null);
  /** Calling code of the receiver's phone: +91 for Indian addresses, chosen from the list abroad. */
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('IN');

  useEffect(() => {
    if (!open) return;
    setValues(address ? fromAddress(address) : EMPTY);
    setPhoneCountry(address ? splitE164(address.mobile).country : 'IN');
    setErrors({});
    setFormError(null);
    setPincodeNote(null);
  }, [open, address]);

  const india = values.country === 'IN';
  const country = countries?.find((c) => c.code === values.country);

  // Delivery estimate for Indian pincodes.
  useEffect(() => {
    const pincode = values.pincode.trim();
    if (!open || !india || !PINCODE_PATTERN.test(pincode)) {
      setPincodeNote(null);
      return;
    }
    let cancelled = false;
    homeApi
      .serviceability(pincode)
      .then((result) => {
        if (cancelled) return;
        setPincodeNote(
          result.serviceable
            ? `Delivers in ${result.estimatedDeliveryDays ?? 'a few'} days${result.codAvailable ? ' · Cash on delivery available' : ''}`
            : 'We will confirm delivery to this pincode at checkout.',
        );
      })
      .catch(() => !cancelled && setPincodeNote(null));
    return () => {
      cancelled = true;
    };
  }, [values.pincode, open, india]);

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(values, country, phoneCountry);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    const input: AddressInput = {
      ...values,
      labelName: values.label === 'OTHER' ? values.labelName?.trim() : undefined,
      mobile: toMobileE164(values.mobile, phoneCountry) ?? values.mobile.trim(),
    };
    try {
      const result = address
        ? await accountApi.updateAddress(address.id, input)
        : await accountApi.createAddress(input);
      onSaved(result.items);
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY) {
        setErrors({ [error.field]: error.message } as Errors);
      } else {
        setFormError(
          error instanceof ApiError && error.message
            ? error.message
            : 'We couldn’t save this address. Try again.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} title={address ? 'Edit address' : 'Add a new address'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy">Save as</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ADDRESS_LABELS) as AddressLabel[]).map((label) => (
              <label
                key={label}
                className={cn(
                  'flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal',
                  values.label === label
                    ? 'border-navy bg-navy text-white'
                    : 'border-slate-300 bg-white text-navy',
                )}
              >
                <input
                  type="radio"
                  name="address-label"
                  value={label}
                  checked={values.label === label}
                  onChange={() => set('label', label)}
                  className="sr-only"
                />
                {ADDRESS_LABELS[label]}
              </label>
            ))}
          </div>
        </fieldset>
        {values.label === 'OTHER' && (
          <TextField
            label="Address name"
            placeholder="e.g. Parents’ home"
            maxLength={30}
            value={values.labelName ?? ''}
            onChange={(e) => set('labelName', e.target.value)}
            error={errors.labelName}
          />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            autoComplete="name"
            maxLength={100}
            value={values.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={errors.fullName}
          />
          <MobileField
            label={india ? 'Mobile number' : 'Phone number'}
            placeholder={india ? '10-digit mobile number' : 'Phone number'}
            country={phoneCountry}
            onCountryChange={india ? undefined : setPhoneCountry}
            value={values.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            error={errors.mobile}
            hint={
              india
                ? 'Used by the courier to reach you'
                : 'Used by the courier to reach the receiver'
            }
          />
        </div>
        {(internationalAllowed || values.country !== 'IN') && (
          <CountrySelect
            countries={countries}
            value={values.country}
            error={errors.country}
            onChange={(code) => {
              setValues((current) => ({
                ...current,
                country: code,
                state: '',
                pincode: '',
                city: current.country === code ? current.city : '',
                mobile: '',
              }));
              if (isCountryCode(code)) setPhoneCountry(code);
              setErrors({});
            }}
          />
        )}
        <TextField
          label="House number, building and street"
          autoComplete="address-line1"
          maxLength={120}
          value={values.line1}
          onChange={(e) => set('line1', e.target.value)}
          error={errors.line1}
        />
        <TextField
          label="Area or locality (optional)"
          autoComplete="address-line2"
          maxLength={120}
          value={values.line2 ?? ''}
          onChange={(e) => set('line2', e.target.value)}
        />
        <TextField
          label="Landmark (optional)"
          placeholder="e.g. Near City Hospital"
          maxLength={80}
          value={values.landmark ?? ''}
          onChange={(e) => set('landmark', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {india ? (
            <PincodeField
              value={values.pincode}
              error={errors.pincode}
              onChange={(text) => set('pincode', text)}
              onResolved={(place) => {
                if (!place) return;
                setValues((current) => ({
                  ...current,
                  pincode: place.pincode,
                  city: place.city,
                  state: place.state,
                  line2: current.line2 || place.area || '',
                }));
                setErrors((current) => ({
                  ...current,
                  pincode: undefined,
                  city: undefined,
                  state: undefined,
                }));
              }}
            />
          ) : (
            <TextField
              label={country?.postalLabel ?? 'Postal code'}
              autoComplete="postal-code"
              maxLength={12}
              placeholder={country?.postalExample || undefined}
              value={values.pincode}
              onChange={(e) => set('pincode', e.target.value.toUpperCase())}
              error={errors.pincode}
            />
          )}
          <CityField
            country={values.country}
            value={values.city}
            onChange={(value) => set('city', value)}
            error={errors.city}
          />
          <StateField
            country={values.country}
            label={india ? 'State' : 'State or province'}
            optional={!(country?.stateRequired ?? india)}
            value={values.state}
            onChange={(value) => set('state', value)}
            error={errors.state}
          />
        </div>
        {!india && (
          <Alert tone="info">
            Addresses outside India are saved for later. Orders and return pickups are delivered
            within India for now.
          </Alert>
        )}
        {pincodeNote && <p className="text-xs text-teal-600">{pincodeNote}</p>}
        {!address?.isDefault && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy">
            <input
              type="checkbox"
              checked={Boolean(values.isDefault)}
              onChange={(e) => set('isDefault', e.target.checked)}
              className="h-4 w-4 accent-teal"
            />
            Make this my default address
          </label>
        )}
        {formError && <Alert>{formError}</Alert>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {address ? 'Save changes' : 'Save address'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
