const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/features', file + '.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, URLSearchParams, ...globals };
  vm.runInNewContext(code, context);
  return context.exports;
}
const category = load('category/query');
const search = load('search/query', { require: () => category });
const parse = (q) => search.parseSearch(new URLSearchParams(q));

test('direct query links, refresh, and history states round-trip', () => {
  const query =
    'q=wireless+headphones&autocorrect=false&category=audio&inStock=true&sort=price_asc&minPricePaise=0&maxPricePaise=200000&store=soundspace&page=2';
  assert.equal(search.serializeSearch(parse(query)), query);
  assert.equal(parse(query).q, 'wireless headphones');
  assert.equal(search.searchHref(parse(query)), '/search?' + query);
});
test('empty and malformed queries are safe and canonical', () => {
  assert.equal(search.searchHref(parse('q=+++')), '/search');
  assert.equal(
    search.serializeSearch(
      parse('q=++headphones++&page=-2&category=bad/path&inStock=no&sort=wrong'),
    ),
    'q=headphones',
  );
  assert.equal(parse('q=' + 'x'.repeat(101)).q.length, 100);
  assert.equal(parse('q=first&q=second').q, 'first');
});
test('filters use shared validation and preserve exact paise', () => {
  const state = parse('q=shirt&minPricePaise=1099&maxPricePaise=1');
  assert.equal(state.minPricePaise, 1099);
  assert.equal(state.maxPricePaise, undefined);
  assert.equal(search.searchApiQuery(state).pageSize, 24);
  assert.equal(search.searchApiQuery(parse('q=typo&autocorrect=false')).autocorrect, false);
});
test('each supported sort remains available for search', () => {
  for (const sort of category.SORTS)
    assert.equal(
      parse(search.serializeSearch(parse('q=shirt&sort=' + sort.value))).sort,
      sort.value,
    );
});
test('recent searches tolerate corrupt storage, deduplicate, normalize, and cap history', () => {
  assert.equal(search.recentSearches({ bad: true }).length, 0);
  assert.equal(
    JSON.stringify(
      search.recentSearches([
        ' Wireless  headphones ',
        'wireless headphones',
        null,
        '',
        42,
        'Shirt',
      ]),
    ),
    JSON.stringify(['Wireless headphones', 'Shirt']),
  );
  assert.equal(search.recentSearches(Array.from({ length: 20 }, (_, i) => 'query ' + i)).length, 6);
});
test('API serialization sends false for original-spelling requests', async () => {
  let requested;
  const { homeApi } = load('home/api', {
    require: (name) =>
      name === '@/lib/http'
        ? {
            apiFetch: async (url) => {
              requested = url;
              return {};
            },
          }
        : { getGuestToken: () => null },
  });
  await homeApi.search({ q: 'wirless', autocorrect: false });
  assert.equal(requested, '/search?q=wirless&autocorrect=false');
});
