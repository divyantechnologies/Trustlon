import { ValidateBy, ValidationOptions } from 'class-validator';
import { MOBILE_RULE_MESSAGE, normalizeMobile } from '../identifier';

/**
 * A customer mobile number in E.164 form (pair with a Transform that calls normalizeMobile).
 * Indian numbers must be 10-digit mobiles; other countries follow their numbering plan.
 */
export function IsMobile(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMobile',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && normalizeMobile(value) === value,
        defaultMessage: () => MOBILE_RULE_MESSAGE,
      },
    },
    options,
  );
}
