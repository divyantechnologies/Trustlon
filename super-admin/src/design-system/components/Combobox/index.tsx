'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { inputClass } from '../../styles';
import { cn as cx } from '../../utils/cn';
import { Field } from '../Field';

export interface ComboboxOption<T> {
  key: string;
  /** Main line, also used as the input text when picked (unless `inputValue` is set). */
  label: string;
  /** Second line, e.g. "Bengaluru, Karnataka". */
  detail?: string;
  inputValue?: string;
  value: T;
}

export type ComboboxProps<T> = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onSelect'
> & {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** Called (debounced) as the customer types. Return suggestions for the text. */
  loadOptions: (text: string, signal: AbortSignal) => Promise<ComboboxOption<T>[]>;
  onPick: (option: ComboboxOption<T>) => void;
  /** Text shown when nothing matches. Leave empty to show nothing. */
  emptyText?: string;
  minChars?: number;
  error?: string;
  hint?: React.ReactNode;
};

/**
 * Text field with a suggestion list (WAI-ARIA combobox). Typing still works when there are no
 * suggestions, so it never blocks free text.
 */
export function Combobox<T>({
  label,
  value,
  onChange,
  loadOptions,
  onPick,
  emptyText,
  minChars = 2,
  error,
  hint,
  id,
  className,
  onBlur,
  onKeyDown,
  ...props
}: ComboboxProps<T>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;
  const [options, setOptions] = useState<ComboboxOption<T>[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);
  const loader = useRef(loadOptions);
  loader.current = loadOptions;

  useEffect(() => {
    if (!typed.current) return;
    const text = value.trim();
    if (text.length < minChars) {
      setOptions([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      loader
        .current(text, controller.signal)
        .then((items) => {
          setOptions(items);
          setActive(items.length ? 0 : -1);
          setOpen(true);
        })
        .catch(() => !controller.signal.aborted && setOptions([]))
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, minChars]);

  const pick = (option: ComboboxOption<T>) => {
    typed.current = false;
    setOpen(false);
    setActive(-1);
    onPick(option);
  };

  const showList = open && (options.length > 0 || Boolean(emptyText && !loading));

  return (
    <Field id={inputId} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          autoComplete="off"
          className={cx(inputClass(Boolean(error)), loading && 'pe-9', className)}
          {...props}
          value={value}
          onChange={(event) => {
            typed.current = true;
            onChange(event.target.value);
          }}
          onBlur={(event) => {
            // Let a click on an option land before closing.
            window.setTimeout(() => setOpen(false), 120);
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            if (showList && options.length) {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((i) => (i + 1) % options.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
              } else if (event.key === 'Enter' && active >= 0) {
                event.preventDefault();
                pick(options[active]);
              }
            }
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              setOpen(false);
            }
            onKeyDown?.(event);
          }}
        />
        {loading && (
          <span
            aria-hidden
            className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"
          />
        )}
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!showList}
          className="absolute start-0 top-full z-20 mt-1 max-h-64 w-full min-w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-sm"
        >
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(index)}
              className={cx(
                'cursor-pointer px-3 py-2 text-sm',
                index === active ? 'bg-navy-50' : 'bg-white',
              )}
            >
              <span className="block font-medium text-navy">{option.label}</span>
              {option.detail && (
                <span className="block text-xs text-slate-500">{option.detail}</span>
              )}
            </li>
          ))}
          {options.length === 0 && emptyText && (
            <li role="presentation" className="px-3 py-2 text-sm text-slate-500">
              {emptyText}
            </li>
          )}
        </ul>
      </div>
    </Field>
  );
}
