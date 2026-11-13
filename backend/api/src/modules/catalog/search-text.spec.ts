import { correctWords, editDistance, queryWords } from './search-text';

describe('catalog spelling correction', () => {
  const vocabulary = ['wireless', 'headphones', 'soundspace', 'cotton', 'shirt'];
  it.each([
    ['wirless', 'wireless', 1],
    ['wirleess', 'wireless', 1],
    ['headphnoes', 'headphones', 1],
    ['headphnes', 'headphones', 1],
    ['wireless', 'wireless', 0],
    ['', 'cat', 3],
  ])('measures edits and transpositions in %s', (a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
  });
  it('corrects a multi-word query and preserves valid terms', () => {
    expect(correctWords(['wirless', 'headphnoes'], vocabulary)).toBe('wireless headphones');
    expect(correctWords(['cotton', 'shirt'], vocabulary)).toBe('cotton shirt');
  });
  it('leaves unrelated, short, and oversized words unchanged', () => {
    expect(correctWords(['zzzzzz', 'tv', 'a'.repeat(100)], vocabulary)).toBe(
      `zzzzzz tv ${'a'.repeat(100)}`,
    );
  });
  it('normalizes case and punctuation without accepting search operators', () => {
    expect(queryWords('WIRELESS + (Headphones)!')).toEqual(['wireless', 'headphones']);
    expect(queryWords('कपड़े शर्ट')).toEqual(['कपड़े', 'शर्ट']);
    expect(queryWords('!!!')).toEqual([]);
    expect(queryWords('a '.repeat(100))).toHaveLength(8);
  });
});
