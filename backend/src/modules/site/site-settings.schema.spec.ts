import {
  businessRulesSchema,
  deepMerge,
  featuresSchema,
  notificationsSchema,
  paymentsSchema,
  readSettings,
  SETTING_GROUPS,
  SETTING_SCHEMAS,
  taxSchema,
  themeSchema,
} from './site-settings.schema';

describe('site settings schema', () => {
  it('has defaults for every group', () => {
    for (const group of SETTING_GROUPS) {
      expect(() => SETTING_SCHEMAS[group].parse({})).not.toThrow();
    }
    const theme = readSettings(themeSchema, undefined);
    expect(theme.colors.navy).toBe('#13233F');
    expect(readSettings(businessRulesSchema, {}).defaultCommissionPercent).toBe(10);
    expect(readSettings(featuresSchema, {}).sellPage).toBe(true);
    expect(readSettings(notificationsSchema, {}).templates.ORDER_PLACED.sms.hi).toContain(
      '{order}',
    );
  });

  it('keeps saved values and defaults the rest', () => {
    const theme = readSettings(themeSchema, { colors: { teal: '#FF6600' } });
    expect(theme.colors.teal).toBe('#FF6600');
    expect(theme.colors.navy).toBe('#13233F');
  });

  it('merges partial updates without losing siblings', () => {
    const base = readSettings(paymentsSchema, {});
    const merged = deepMerge(base, { methods: { cod: false } });
    expect(merged.methods.cod).toBe(false);
    expect(merged.methods.upi).toBe(true);
    expect(
      businessRulesSchema.safeParse(
        deepMerge(readSettings(businessRulesSchema, {}), { defaultCommissionPercent: 99 }),
      ).success,
    ).toBe(false);
    expect(themeSchema.safeParse({ colors: { navy: 'blue' } }).success).toBe(false);
  });

  it('checks operator GSTINs against their state code', () => {
    expect(
      taxSchema.safeParse({ operatorGstins: [{ stateCode: '29', gstin: '29ABCDE1234F1Z5' }] })
        .success,
    ).toBe(true);
    expect(
      taxSchema.safeParse({ operatorGstins: [{ stateCode: '27', gstin: '29ABCDE1234F1Z5' }] })
        .success,
    ).toBe(false);
  });
});
