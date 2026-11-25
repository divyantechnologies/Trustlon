/**
 * Notification preferences (spec 3.11): which channels a customer wants for each kind of message.
 * The notification service (Phase 6) reads these before sending anything.
 */

export const NOTIFICATION_CHANNELS = ['sms', 'email', 'whatsapp', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENTS = [
  'orders',
  'delivery',
  'returns',
  'priceAlerts',
  'offers',
  'account',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type ChannelChoice = Record<NotificationChannel, boolean>;
export type NotificationChoices = Record<NotificationEvent, ChannelChoice>;

/** Sign-in codes, password changes and new-device alerts are always sent by SMS and email. */
export const LOCKED_EVENTS: NotificationEvent[] = ['account'];

/** Offers and recommendations are marketing; they follow the sign-up consent until changed. */
export const MARKETING_EVENT: NotificationEvent = 'offers';

const all = (on: boolean): ChannelChoice => ({ sms: on, email: on, whatsapp: on, push: on });

export function defaultChoices(marketingOptIn: boolean): NotificationChoices {
  return {
    orders: all(true),
    delivery: all(true),
    returns: all(true),
    priceAlerts: { sms: false, email: true, whatsapp: false, push: true },
    offers: { sms: false, email: marketingOptIn, whatsapp: false, push: marketingOptIn },
    account: { sms: true, email: true, whatsapp: false, push: true },
  };
}

/** Saved choices on top of the defaults. Unknown keys and non-boolean values are ignored. */
export function mergeChoices(base: NotificationChoices, saved: unknown): NotificationChoices {
  const result = JSON.parse(JSON.stringify(base)) as NotificationChoices;
  if (!saved || typeof saved !== 'object') return result;
  for (const event of NOTIFICATION_EVENTS) {
    const entry = (saved as Record<string, unknown>)[event];
    if (!entry || typeof entry !== 'object') continue;
    for (const channel of NOTIFICATION_CHANNELS) {
      const value = (entry as Record<string, unknown>)[channel];
      if (typeof value === 'boolean') result[event][channel] = value;
    }
  }
  // Security messages can't be switched off by SMS or email.
  for (const event of LOCKED_EVENTS) {
    result[event].sms = true;
    result[event].email = true;
  }
  return result;
}

export const wantsMarketing = (choices: NotificationChoices) =>
  NOTIFICATION_CHANNELS.some((channel) => choices[MARKETING_EVENT][channel]);
