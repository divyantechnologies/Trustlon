const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Run the actual TypeScript helpers with Node's built-in runner, without a new dependency.
function load(name, globals = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/features/category', name + '.ts'),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, URLSearchParams, ...globals };
  vm.runInNewContext(code, context);
  return context.exports;
}

const { parseQuery, serializeQuery, productQuery, priceToPaise, SORTS } = load('query');
const parse = (search) => parseQuery(new URLSearchParams(search));

test('price filter labels preserve paise while existing card formatting stays unchanged', () => {
  const { formatPrice } = load('../home/format');
  assert.equal(formatPrice(1009, { showPaise: true }), '₹10.09');
  assert.equal(formatPrice(1, { showPaise: true }), '₹0.01');
  assert.equal(formatPrice(1009), '₹10');
});

test('all supported sorts round-trip; default parameters are omitted', () => {
  for (const { value } of SORTS)
    assert.equal(parse(serializeQuery(parse(`sort=${value}`))).sort, value);
  assert.equal(serializeQuery(parse('sort=relevance&page=1')), '');
});

test('unknown and invalid parameters never enter the API query', () => {
  const state = parse(
    'brand=a,b&verified=1&sort=invalid&page=-1&minPricePaise=1.5&maxPricePaise=-50',
  );
  assert.equal(serializeQuery(state), '');
  const query = productQuery('clothing', state);
  assert.equal(query.category, 'clothing');
  assert.equal(query.pageSize, 24);
  assert.equal(query.brand, undefined);
  assert.equal(query.verified, undefined);
});

test('API-compatible price and single-store filters round-trip with the page', () => {
  const search = 'sort=price_asc&minPricePaise=50000&maxPricePaise=200000&store=trustlon&page=3';
  assert.equal(serializeQuery(parse(search)), search);
  assert.equal(productQuery('clothing', parse(search)).minPricePaise, 50000);
});

test('inverted URL prices retain the lower bound and discard the invalid upper bound', () => {
  assert.equal(serializeQuery(parse('minPricePaise=500&maxPricePaise=100')), 'minPricePaise=500');
});

test('zero prices are real filters; duplicated values canonicalize to one', () => {
  assert.equal(
    serializeQuery(parse('minPricePaise=0&maxPricePaise=0&page=2&page=8')),
    'minPricePaise=0&maxPricePaise=0&page=2',
  );
});

test('page and price integers reject overflow, exponents, whitespace, and fractional values', () => {
  for (const value of ['9007199254740992', '1e3', '2.5', '%20', '-5']) {
    assert.equal(parse(`page=${value}`).page, 1);
    assert.equal(parse(`minPricePaise=${value}`).minPricePaise, undefined);
  }
  assert.equal(parse('page=0').page, 1);
  assert.equal(parse('page=0002').page, 2);
});

test('multi-vendor values and overlong or unsafe slugs are not sent as single vendors', () => {
  for (const value of ['one,two', 'a'.repeat(81), 'hello/world'])
    assert.equal(parse(`store=${value}`).store, undefined);
});

test('rupee input converts exactly to paise without silently rounding', () => {
  assert.equal(priceToPaise(''), undefined);
  assert.equal(priceToPaise('0'), 0);
  assert.equal(priceToPaise('10.09'), 1009);
  assert.equal(priceToPaise(' 10.1 '), 1010);
  for (const value of ['-1', '1.234', '1e5', 'Infinity', 'text', '9007199254740992']) {
    assert.equal(Number.isNaN(priceToPaise(value)), true);
  }
});

function cacheWith(api, clock = () => Date.now()) {
  return load('cache', { require: () => ({ homeApi: api }), Date: { now: clock } });
}

test('simultaneous and repeated requests share the same page fetch', async () => {
  let calls = 0;
  let resolve;
  const cache = cacheWith({
    products: () => {
      calls++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const query = { category: 'clothing', pageSize: 24 };
  const first = cache.loadProducts(query, 1);
  const second = cache.loadProducts(query, 1);
  assert.equal(first, second);
  await Promise.resolve();
  resolve({ items: [], page: 1, totalPages: 1 });
  await Promise.all([first, second]);
  await cache.loadProducts(query, 1);
  assert.equal(calls, 1);
});

test('page, category, sort, and filter changes have distinct cache keys', async () => {
  let calls = 0;
  const cache = cacheWith({
    products: async (query) => {
      calls++;
      return { items: [], page: query.page };
    },
  });
  await cache.loadProducts({ category: 'a' }, 1);
  await cache.loadProducts({ category: 'a' }, 2);
  await cache.loadProducts({ category: 'b' }, 1);
  await cache.loadProducts({ category: 'a', sort: 'newest' }, 1);
  await cache.loadProducts({ category: 'a', minPricePaise: 0 }, 1);
  assert.equal(calls, 5);
});

test('failed next-page fetch can retry without evicting successful earlier pages', async () => {
  const calls = new Map();
  const cache = cacheWith({
    products: async ({ page }) => {
      calls.set(page, (calls.get(page) ?? 0) + 1);
      if (page === 2 && calls.get(page) === 1) throw new Error('temporary network failure');
      return { items: [], page };
    },
  });
  await cache.loadProducts({ category: 'a' }, 1);
  await assert.rejects(cache.loadProducts({ category: 'a' }, 2));
  await cache.loadProducts({ category: 'a' }, 1);
  await cache.loadProducts({ category: 'a' }, 2);
  assert.equal(calls.get(1), 1);
  assert.equal(calls.get(2), 2);
});

test('expired catalog entries refresh after five minutes', async () => {
  let time = 0;
  let calls = 0;
  const cache = cacheWith(
    {
      category: async () => {
        calls++;
        return {};
      },
    },
    () => time,
  );
  await cache.loadCategory('a');
  time = 299999;
  await cache.loadCategory('a');
  assert.equal(calls, 1);
  time = 300000;
  await cache.loadCategory('a');
  assert.equal(calls, 2);
});

test('catalog cache evicts old settled entries at its size bound', async () => {
  let calls = 0;
  const cache = cacheWith({
    category: async () => {
      calls++;
      return {};
    },
  });
  for (let index = 0; index < 121; index++) await cache.loadCategory(String(index));
  await cache.loadCategory('0');
  assert.equal(calls, 122);
});

test('overlapping API pages do not render duplicate product IDs or reorder existing results', () => {
  const cache = cacheWith({});
  const result = cache.uniqueProducts([
    { items: [{ id: 'a', name: 'original' }, { id: 'b' }] },
    { items: [{ id: 'a', name: 'duplicate' }, { id: 'c' }] },
  ]);
  assert.equal(result.map((product) => product.id).join(','), 'a,b,c');
  assert.equal(result[0].name, 'original');
});
