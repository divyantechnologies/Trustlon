'use client';
import { useEffect, useId, useState } from 'react';
import { Alert, Button, cn, Dialog, focusRing, inputClass, TextField } from '@/design-system';
import { homeApi } from '@/features/home/api';
import { ApiError } from '@/lib/http';
import { accountApi } from '../api';
import { ADDRESS_LABELS, INDIAN_STATES } from '../format';
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
  city: '',
  state: '',
  isDefault: false,
};

function fromAddress(address: Address): AddressInput {
  return {
    label: address.label,
    labelName: address.labelName ?? '',
    fullName: address.fullName,
    mobile: address.mobile.replace(/^\+91/, ''),
    line1: address.line1,
    line2: address.line2 ?? '',
    landmark: address.landmark ?? '',
    pincode: address.pincode,
    city: address.city,
    state: address.state,
    isDefault: address.isDefault,
  };
}

function validate(values: AddressInput): Errors {
  const errors: Errors = {};
  if (values.fullName.trim().length < 2)
    errors.fullName = 'Enter the full name of the person receiving the order';
  if (!/^(\+?91)?[6-9]\d{9}$/.test(values.mobile.replace(/[\s-]/g, ''))) {
    errors.mobile = 'Enter a valid 10-digit Indian mobile number';
  }
  if (values.line1.trim().length < 3) errors.line1 = 'Enter the house number and street';
  if (!/^[1-9]\d{5}$/.test(values.pincode.trim()))
    errors.pincode = 'Enter a valid six-digit pincode';
  if (values.city.trim().length < 2) errors.city = 'Enter the city or town';
  if (!values.state) errors.state = 'Choose a state';
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
  const stateId = useId();
  const [values, setValues] = useState<AddressInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pincodeNote, setPincodeNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(address ? fromAddress(address) : EMPTY);
    setErrors({});
    setFormError(null);
    setPincodeNote(null);
  }, [open, address]);

  // Look up the pincode once six digits are typed.
  useEffect(() => {
    const pincode = values.pincode.trim();
    if (!open || !/^[1-9]\d{5}$/.test(pincode)) {
      setPincodeNote(null);
      return;
    }
    let cancelled = false;
    homeApi
      .serviceability(pincode)
      .then((result) => {
        if (cancelled) return;
        if (result.city && result.state) {
          setValues((current) => ({
            ...current,
            city: result.city ?? current.city,
            state: result.state ?? current.state,
          }));
        }
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
  }, [values.pincode, open]);

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    const input: AddressInput = {
      ...values,
      labelName: values.label === 'OTHER' ? values.labelName?.trim() : undefined,
      mobile: values.mobile.replace(/[\s-]/g, ''),
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            autoComplete="name"
            maxLength={100}
            value={values.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={errors.fullName}
          />
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="10-digit mobile number"
            maxLength={14}
            value={values.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            error={errors.mobile}
            hint="Used by the courier to reach you"
          />
        </div>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={values.pincode}
            onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
            error={errors.pincode}
          />
          <TextField
            label="City"
            autoComplete="address-level2"
            maxLength={80}
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
            error={errors.city}
          />
          <div>
            <label htmlFor={stateId} className="mb-1.5 block text-sm font-medium text-navy">
              State
            </label>
            <select
              id={stateId}
              value={values.state}
              autoComplete="address-level1"
              onChange={(e) => set('state', e.target.value)}
              aria-invalid={Boolean(errors.state) || undefined}
              className={cn(inputClass(Boolean(errors.state)), focusRing)}
            >
              <option value="">Choose</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {errors.state && (
              <p role="alert" className="mt-1.5 text-xs text-red-600">
                {errors.state}
              </p>
            )}
          </div>
        </div>
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
