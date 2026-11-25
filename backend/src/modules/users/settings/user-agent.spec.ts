import { describeUserAgent } from './user-agent';
import { defaultChoices, mergeChoices, wantsMarketing } from './notification-preferences';

describe('describeUserAgent', () => {
  it('names common browsers and systems', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'Windows', mobile: false });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Safari', os: 'iOS', mobile: true });
    expect(describeUserAgent(undefined).browser).toBe('Unknown browser');
  });
});

describe('notification preferences', () => {
  it('keeps security messages on and follows marketing consent by default', () => {
    const merged = mergeChoices(defaultChoices(false), {
      account: { sms: false, email: false, push: false },
      offers: { email: 'yes' },
      unknown: { sms: true },
    });
    expect(merged.account).toEqual({ sms: true, email: true, whatsapp: false, push: false });
    expect(merged.offers.email).toBe(false);
    expect(wantsMarketing(merged)).toBe(false);
    expect(wantsMarketing(defaultChoices(true))).toBe(true);
  });
});
