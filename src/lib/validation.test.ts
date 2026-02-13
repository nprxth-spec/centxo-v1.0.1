import { describe, it, expect } from 'vitest';
import {
  formDataToObject,
  campaignCreateSchema,
  validateRequestBody,
  validateQueryParams,
  campaignsQuerySchema,
} from './validation';

describe('formDataToObject', () => {
  it('copies string entries to object', () => {
    const fd = new FormData();
    fd.append('a', '1');
    fd.append('b', 'x');
    expect(formDataToObject(fd)).toEqual({ a: '1', b: 'x' });
  });

  it('skips File/Blob values', () => {
    const fd = new FormData();
    fd.append('k', 'v');
    fd.append('f', new Blob(['x']), 'f.txt');
    const out = formDataToObject(fd);
    expect(out).toEqual({ k: 'v' });
    expect(out).not.toHaveProperty('f');
  });

  it('returns empty object for empty FormData', () => {
    expect(formDataToObject(new FormData())).toEqual({});
  });
});

describe('campaignCreateSchema', () => {
  const minimal = {
    adAccountId: 'act_123',
    campaignObjective: 'OUTCOME_ENGAGEMENT',
    pageId: 'pid',
  };

  it('accepts minimal valid input', () => {
    const r = campaignCreateSchema.safeParse(minimal);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.adAccountId).toBe('act_123');
      expect(r.data.pageId).toBe('pid');
      expect(r.data.campaignCount).toBe(1);
      expect(r.data.adSetCount).toBe(1);
      expect(r.data.adsCount).toBe(1);
      expect(r.data.targetCountry).toBe('TH');
      expect(r.data.placements).toEqual(['facebook', 'instagram', 'messenger']);
      expect(r.data.ageMin).toBe(20);
      expect(r.data.ageMax).toBe(50);
    }
  });

  it('rejects missing adAccountId', () => {
    const r = campaignCreateSchema.safeParse({ ...minimal, adAccountId: '' });
    expect(r.success).toBe(false);
  });

  it('rejects missing pageId', () => {
    const r = campaignCreateSchema.safeParse({ ...minimal, pageId: '' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid campaignObjective', () => {
    const r = campaignCreateSchema.safeParse({ ...minimal, campaignObjective: 'INVALID' });
    expect(r.success).toBe(false);
  });

  it('transforms dailyBudget string to number', () => {
    const r = campaignCreateSchema.safeParse({ ...minimal, dailyBudget: '100' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dailyBudget).toBe(100);
  });

  it('rejects dailyBudget < 1 when provided', () => {
    const r = campaignCreateSchema.safeParse({ ...minimal, dailyBudget: '0' });
    expect(r.success).toBe(false);
  });

  it('transforms and clamps campaignCount, adSetCount, adsCount', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      campaignCount: '5',
      adSetCount: '3',
      adsCount: '10',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.campaignCount).toBe(5);
      expect(r.data.adSetCount).toBe(3);
      expect(r.data.adsCount).toBe(10);
    }
  });

  it('clamps counts to max', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      campaignCount: '99',
      adSetCount: '99',
      adsCount: '99',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.campaignCount).toBe(10);
      expect(r.data.adSetCount).toBe(10);
      expect(r.data.adsCount).toBe(20);
    }
  });

  it('transforms placements string to array', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      placements: 'facebook,instagram,messenger',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.placements).toEqual(['facebook', 'instagram', 'messenger']);
  });

  it('filters invalid placement values', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      placements: 'facebook,other,twitter',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.placements).toEqual(['facebook']);
  });

  it('transforms and clamps ageMin, ageMax', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      ageMin: '25',
      ageMax: '55',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ageMin).toBe(25);
      expect(r.data.ageMax).toBe(55);
    }
  });

  it('clamps age to 18–65', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      ageMin: '10',
      ageMax: '80',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ageMin).toBe(18);
      expect(r.data.ageMax).toBe(65);
    }
  });

  it('parses valid manualIceBreakers JSON', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      manualIceBreakers: JSON.stringify([
        { question: 'Q1', payload: 'P1' },
        { question: 'Q2', payload: '' },
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.manualIceBreakers).toHaveLength(2);
      expect(r.data.manualIceBreakers![0]).toEqual({ question: 'Q1', payload: 'P1' });
    }
  });

  it('returns null for invalid manualIceBreakers', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      manualIceBreakers: 'not json',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.manualIceBreakers).toBeNull();
  });

  it('rejects primaryText over 2000 chars', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      primaryText: 'x'.repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it('rejects headline over 255 chars', () => {
    const r = campaignCreateSchema.safeParse({
      ...minimal,
      headline: 'x'.repeat(256),
    });
    expect(r.success).toBe(false);
  });
});

describe('validateRequestBody', () => {
  it('returns success for valid data', () => {
    const r = validateRequestBody(campaignsQuerySchema, { adAccountId: 'act_1' });
    expect(r.success).toBe(true);
  });

  it('returns error for invalid data', () => {
    const r = validateRequestBody(campaignsQuerySchema, {});
    expect(r.success).toBe(false);
  });
});

describe('validateQueryParams', () => {
  it('parses URLSearchParams to object and validates', () => {
    const p = new URLSearchParams({ adAccountId: 'act_1' });
    const r = validateQueryParams(campaignsQuerySchema, p);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.adAccountId).toBe('act_1');
  });

  it('fails when required param missing', () => {
    const r = validateQueryParams(campaignsQuerySchema, new URLSearchParams());
    expect(r.success).toBe(false);
  });
});
