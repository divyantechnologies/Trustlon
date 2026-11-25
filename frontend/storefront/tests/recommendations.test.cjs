const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function loadApi(globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/home/api.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {},
    URLSearchParams,
    require: (name) => {
      if (name === '@/lib/http') return { apiFetch: globals.apiFetch ?? (async () => ({})) };
      if (name === './guest') return { getGuestToken: () => null };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

const product = {
  id: 'product-1',
  slug: 'sample-product',
  name: 'Sample product',
  image: '/sample.jpg',
  category: { slug: 'sample-category', name: 'Sample category', nameHi: null },
  seller: { slug: 'sample-seller', name: 'Sample seller', isVerified: true, isPlatformOwned: false, trustScore: 90 },
  currency: 'INR',
  pricePaise: 10000,
  mrpPaise: 12000,
  discountPercent: 17,
  rating: 4.5,
  ratingCount: 12,
  badge: null,
  inStock: true,
  codAvailable: true,
  deal: null,
};

test('accepts actual recommendation envelope and an empty product array', () => {
  const { parseRecommendations } = loadApi();
  assert.deepEqual(parseRecommendations({ items: [product] }).map((item) => item.id), ['product-1']);
  assert.deepEqual(parseRecommendations({ items: [] }), []);
});

test('null, undefined, missing, and unexpected envelopes are rejected as invalid', () => {
  const { parseRecommendations } = loadApi();
  for (const response of [null, undefined, {}, { data: [product] }, { items: null }, { items: 'invalid' }]) {
    assert.throws(() => parseRecommendations(response), /invalid response/);
  }
});

test('filters malformed products while retaining valid recommendations', () => {
  const { parseRecommendations } = loadApi();
  assert.deepEqual(parseRecommendations({ items: [null, {}, { ...product, seller: null }, product] }).map((item) => item.id), ['product-1']);
  assert.throws(() => parseRecommendations({ items: [null, {}] }), /no valid products/);
});

test('recommendations forwards the abort signal and normalizes the response', async () => {
  const signal = new AbortController().signal;
  let requestOptions;
  const { homeApi } = loadApi({
    apiFetch: async (_url, options) => {
      requestOptions = options;
      return { items: [product] };
    },
  });
  const response = await homeApi.recommendations(10, signal);
  assert.equal(requestOptions.signal, signal);
  assert.deepEqual(response.items.map((item) => item.id), ['product-1']);
});

test('recommendations leaves API errors rejectable for component error handling', async () => {
  const { homeApi } = loadApi({ apiFetch: async () => { throw new Error('network failure'); } });
  await assert.rejects(homeApi.recommendations(), /network failure/);
});
