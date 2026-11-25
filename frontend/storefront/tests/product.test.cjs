const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Exercise real TS/TSX components with the existing Node runner; no test-only rendering substitutes.
for (const ext of ['.ts', '.tsx'])
  require.extensions[ext] = (module, file) => {
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    module._compile(result.outputText, file);
  };
const { mockProducts } = require('../src/features/product/mock/products.ts');
const { ProductView } = require('../src/features/product/ProductView.tsx');
const { adaptProduct, toCatalogProduct } = require('../src/features/product/adapter.ts');
const {
  initialSelection,
  resolveSelection,
  historyWindow,
  productJsonLd,
} = require('../src/features/product/helpers.ts');
const { getCategoryConfig, categoryConfig } = require('../src/features/product/categoryConfig.ts');
const { availableSections } = require('../src/features/product/components/SectionRenderer.tsx');
const actions = {
  addToCart: async () => {},
  buyNow: async () => {},
  wishlist: async () => {},
  checkDelivery: async () => '',
  setAlert: async () => {},
};
const render = (p) =>
  renderToStaticMarkup(React.createElement(ProductView, { product: p, actions }));
for (const product of mockProducts)
  test(`renders ${product.category.id} through the same template`, () => {
    const p = adaptProduct(product);
    const html = render(p);
    assert.ok(html.includes(p.title));
    assert.ok(html.includes('Product sections'));
    assert.ok(html.includes('id="specs"'));
    assert.doesNotMatch(html, /Not available/);
    if (p.id !== 'headphones') assert.doesNotMatch(html, /Bluetooth|40 mm drivers|Sound/);
  });
test('category-specific information comes from config and product data', () => {
  assert.match(render(mockProducts[1]), /Size guide/);
  assert.match(render(mockProducts[3]), /Nutrition/);
  assert.doesNotMatch(render(mockProducts[3]), /Size guide|Warranty/);
  assert.match(render(mockProducts[4]), /Notify me/);
});
test('missing optional fields hide sections and do not invent trust claims', () => {
  const { id, slug, title, brand, category, images, price, stock, seller } = mockProducts[0];
  const p = { id, slug, title, brand, category, images: [], price, stock, seller };
  const html = render(p);
  for (const section of [
    'offers',
    'specs',
    'description',
    'widgets',
    'policies',
    'history',
    'similar',
    'together',
  ])
    assert.ok(!html.includes(`id="${section}"`));
  assert.match(html, /Be the first to review/);
  assert.match(html, /Ask the first question/);
  assert.match(html, /Image coming soon/);
  assert.doesNotMatch(html, /Escrow protection|Authenticity assured|EMI/);
});
test('legacy paise normalization keeps purchase limits separate from inventory', () => {
  const p = adaptProduct({
    id: 'id',
    slug: 'sample',
    name: 'Sample',
    brand: null,
    image: '/test.png',
    category: { slug: 'general', name: 'General' },
    seller: { name: 'Shop', isVerified: true },
    pricePaise: 10099,
    mrpPaise: 20000,
    inStock: true,
    maxQuantity: 10,
    rating: 0,
    ratingCount: 0,
    description: null,
    codAvailable: false,
  });
  assert.equal(p.price.current, 100.99);
  assert.equal(p.purchaseLimit, 10);
  assert.equal(p.stock.quantity, undefined);
  assert.doesNotMatch(render(p), /Only 10|Not specified|Cash on delivery/);
});
test('invalid optional fields are dropped, malformed prices rejected and unsafe URLs removed', () => {
  const p = adaptProduct({
    ...mockProducts[0],
    reviews: [{ broken: true }],
    offers: null,
    images: [{ url: 'javascript:alert(1)', alt: 'bad' }],
  });
  assert.equal(p.reviews, undefined);
  assert.equal(p.offers, undefined);
  assert.equal(p.images.length, 0);
  assert.throws(() => adaptProduct({ ...p, price: { ...p.price, current: -1 } }));
});
test('variant price, image and inventory resolve together; unavailable options cannot be purchased', () => {
  const p = {
    ...mockProducts[1],
    variants: [
      {
        type: 'size',
        label: 'Size',
        options: [
          { value: 'S', available: true },
          {
            value: 'M',
            available: true,
            priceDelta: 100,
            image: '/m.png',
            stock: { status: 'low', quantity: 2 },
          },
          { value: 'L', available: false },
        ],
      },
    ],
  };
  const result = resolveSelection(p, { size: 'M' });
  assert.equal(result.product.price.current, 899);
  assert.equal(result.selectedImage, '/m.png');
  assert.equal(result.product.stock.quantity, 2);
  assert.equal(result.product.stock.status, 'low');
  assert.equal(resolveSelection(p, { size: 'L' }).canBuy, false);
});

test('malformed purchase constraints keep the page readable without enabling purchases', () => {
  for (const invalid of [
    { variants: [{ type: 'size', options: 'broken' }] },
    { skus: [{ id: 'incomplete' }] },
    { purchaseLimit: -1 },
  ]) {
    const p = adaptProduct({ ...mockProducts[0], ...invalid });
    assert.match(render(p), /Notify me/);
    assert.equal(resolveSelection(p, initialSelection(p)).canBuy, false);
    assert.equal(toCatalogProduct(p).inStock, false);
  }
});

test('zero option inventory cannot be overridden by an otherwise stocked SKU', () => {
  const p = {
    ...mockProducts[0],
    variants: [{ type: 'color', label: 'Color', options: [
      { value: 'Black', available: true, stock: { status: 'in_stock', quantity: 0 } },
    ] }],
    skus: [{ id: 'black', selections: { color: 'Black' }, price: 2499,
      stock: { status: 'in_stock', quantity: 10 } }],
  };
  assert.equal(resolveSelection(p, { color: 'Black' }).canBuy, false);
  assert.equal(toCatalogProduct({ ...p, stock: { status: 'in_stock', quantity: 0 } }).inStock, false);
});
test('SKU inventory and price override option deltas and reject nonexistent combinations', () => {
  const p = {
    ...mockProducts[1],
    skus: [
      {
        id: 'sku1',
        selections: { size: 'M', color: 'Navy' },
        price: 999,
        stock: { status: 'low', quantity: 1 },
        image: '/sku.png',
      },
    ],
  };
  assert.deepEqual(initialSelection(p), { size: 'M', color: 'Navy' });
  const selected = resolveSelection(p, initialSelection(p));
  assert.equal(selected.product.price.current, 999);
  assert.equal(selected.skuId, 'sku1');
  assert.equal(selected.product.stock.quantity, 1);
  assert.equal(resolveSelection(p, { size: 'S', color: 'White' }).canBuy, false);
});
test('90-day history excludes future and older records and sorts by date', () => {
  const p = {
    ...mockProducts[0],
    priceHistory: [
      { date: '2026-11-16', price: 100 },
      { date: '2026-01-01', price: 1 },
      { date: '2027-01-01', price: 2 },
      { date: '2026-10-01', price: 90 },
    ],
  };
  assert.deepEqual(historyWindow(p, Date.parse('2026-11-16')), [
    { date: '2026-10-01', price: 90 },
    { date: '2026-11-16', price: 100 },
  ]);
});
test('config-only new category controls section order without template changes', () => {
  categoryConfig.books = {
    ...categoryConfig.default,
    variantOrder: ['edition'],
    defaultIcon: 'box',
    sectionOrder: ['reviews', 'specs', 'qna'],
  };
  const p = { ...mockProducts[0], category: { id: 'books', name: 'Books', path: ['Books'] } };
  assert.deepEqual(
    availableSections(p, getCategoryConfig(p.category), { together: [], similar: [], recent: [] }),
    ['reviews', 'specs', 'qna'],
  );
  delete categoryConfig.books;
});
test('structured data reflects stock and omits absent ratings', () => {
  const ld = productJsonLd(mockProducts[4]);
  assert.equal(ld.offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(productJsonLd(mockProducts[0]).offers.price, 2499);
});
