'use client';
import { useState } from 'react';
import { Button, Dialog, TextField } from '@/design-system';
import { pincodeError } from '../query';

export function LocationBar({
  pincode,
  open,
  onOpenChange,
  onSave,
  signedIn,
}: {
  pincode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (pincode: string) => Promise<void>;
  signedIn: boolean;
}) {
  const [draft, setDraft] = useState(pincode);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const change = () => {
    setDraft(pincode);
    setError(undefined);
    onOpenChange(true);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p>
        Deliver to <strong>{pincode || 'your neighbourhood'}</strong>
      </p>
      <Button variant="link" aria-label="Change delivery pincode" onClick={change}>
        Change
      </Button>
      <Dialog
        open={open}
        title="Choose your delivery location"
        onClose={() => {
          if (!busy) onOpenChange(false);
        }}
      >
        <form
          className="space-y-5"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const invalid = pincodeError(draft);
            setError(invalid);
            if (invalid) return;
            setBusy(true);
            try {
              await onSave(draft);
              onOpenChange(false);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : 'Could not save this location. Please try again.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextField
            label="Delivery pincode"
            value={draft}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            pattern="[1-9][0-9]{5}"
            required
            error={error}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
          />
          {signedIn && (
            <p className="text-sm text-slate-500">
              For supported pincodes, this also updates the pincode, city and state on your default
              Indian address.
            </p>
          )}
          <Button type="submit" loading={busy}>
            Use this pincode
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
