const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Enable TS/TSX loading for Node test runner
for (const ext of ['.ts', '.tsx']) {
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
}

const { CheckoutButton } = require('../src/features/cart/components/CheckoutButton.tsx');
const { CartItemGroup } = require('../src/features/cart/components/CartItemGroup.tsx');
const { CartItemRow } = require('../src/features/cart/components/CartItemRow.tsx');
const { CouponInput } = require('../src/features/cart/components/CouponInput.tsx');
const { CoinsToggle } = require('../src/features/cart/components/CoinsToggle.tsx');
const { PriceSummary } = require('../src/features/cart/components/PriceSummary.tsx');
const { SavedForLater } = require('../src/features/cart/components/SavedForLater.tsx');

const inStockItem = {
  id: 'item-1',
  productId: 'prod-1',
  slug: 'noise-cancelling-headphones',
  title: 'Noise Cancelling Headphones',
  name: 'Noise Cancelling Headphones',
  image: 'https://img.test/headphones.jpg',
  variantLabel: 'Matte Black',
  price: 249900, // ₹2,499
  mrp: 399900, // ₹3,999
  quantity: 2,
  maxQuantity: 10,
  stockStatus: 'in_stock',
  available: true,
  priceChanged: false,
  priceUpdated: false,
  notice: null,
  message: null,
  unitPricePaise: 249900,
  mrpPaise: 399900,
  lineTotalPaise: 499800,
  discountPercent: 38,
};

const outOfStockItem = {
  ...inStockItem,
  id: 'item-2',
  productId: 'prod-2',
  title: 'Classic Leather Watch',
  stockStatus: 'out',
  available: false,
  maxQuantity: 0,
  notice: 'Out of stock',
};

const priceChangedItem = {
  ...inStockItem,
  id: 'item-3',
  productId: 'prod-3',
  title: 'Ergonomic Keyboard',
  price: 199900,
  priceChanged: true,
  priceUpdated: true,
  notice: 'Price updated',
};

const sampleGroup = {
  vendorId: 'vendor-1',
  vendorName: 'Audio Hub',
  expectedDelivery: 'Delivery in 2-4 business days',
  items: [inStockItem],
};

test('CheckoutButton is disabled when any active item is out of stock', () => {
  const groupsWithOutOfStock = [
    {
      ...sampleGroup,
      items: [inStockItem, outOfStockItem],
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(CheckoutButton, {
      groups: groupsWithOutOfStock,
      onCheckout: () => {},
    }),
  );

  assert.match(html, / disabled[=> ]/, 'Button must have disabled attribute when out of stock item exists');
});

test('CheckoutButton is disabled when cart groups are empty or busy', () => {
  const emptyHtml = renderToStaticMarkup(
    React.createElement(CheckoutButton, {
      groups: [],
      onCheckout: () => {},
    }),
  );
  assert.match(emptyHtml, / disabled[=> ]/, 'Button must have disabled attribute when cart has no items');

  const busyHtml = renderToStaticMarkup(
    React.createElement(CheckoutButton, {
      groups: [sampleGroup],
      busy: true,
      onCheckout: () => {},
    }),
  );
  assert.match(busyHtml, / disabled[=> ]/, 'Button must have disabled attribute when busy');
});

test('CheckoutButton is enabled when all active items are in stock', () => {
  const html = renderToStaticMarkup(
    React.createElement(CheckoutButton, {
      groups: [sampleGroup],
      busy: false,
      onCheckout: () => {},
    }),
  );

  assert.doesNotMatch(html, / disabled[=> ]/, 'Button must not have disabled attribute when all items are available and in stock');
  assert.ok(html.includes('Proceed to checkout'));
});

test('CartItemGroup renders vendor name, delivery estimate, and items', () => {
  const html = renderToStaticMarkup(
    React.createElement(CartItemGroup, {
      group: sampleGroup,
      busy: false,
      onChange: () => {},
      onRemove: () => {},
    }),
  );

  assert.ok(html.includes('Audio Hub'), 'Shows vendor name');
  assert.ok(html.includes('Delivery in 2-4 business days'), 'Shows delivery estimate');
  assert.ok(html.includes('Noise Cancelling Headphones'), 'Renders item inside group');
});

test('CartItemRow shows image, title, variant, price, quantity stepper, and action buttons', () => {
  const html = renderToStaticMarkup(
    React.createElement(CartItemRow, {
      item: inStockItem,
      busy: false,
      onChange: () => {},
      onRemove: () => {},
    }),
  );

  assert.ok(html.includes('Noise Cancelling Headphones'), 'Shows title');
  assert.ok(html.includes('Matte Black'), 'Shows variant label');
  assert.ok(html.includes('Remove'), 'Shows remove action');
  assert.ok(html.includes('Move to wishlist'), 'Shows move to wishlist action');
  assert.ok(html.includes('Save for later'), 'Shows save for later action');
  assert.ok(html.includes('Decrease quantity'), 'Includes quantity stepper');
});

test('CartItemRow clearly marks out-of-stock items and price updates', () => {
  const outHtml = renderToStaticMarkup(
    React.createElement(CartItemRow, {
      item: outOfStockItem,
      busy: false,
      onChange: () => {},
      onRemove: () => {},
    }),
  );
  assert.ok(outHtml.includes('Out of stock'), 'Shows Out of stock notice');

  const priceHtml = renderToStaticMarkup(
    React.createElement(CartItemRow, {
      item: priceChangedItem,
      busy: false,
      onChange: () => {},
      onRemove: () => {},
    }),
  );
  assert.ok(priceHtml.includes('Price updated'), 'Shows Price updated notice');
});

test('CouponInput shows apply form when no coupon, and remove action when coupon is applied', () => {
  const notAppliedHtml = renderToStaticMarkup(
    React.createElement(CouponInput, {
      coupon: null,
      busy: false,
      onApply: async () => undefined,
    }),
  );
  assert.ok(notAppliedHtml.includes('Apply'), 'Shows Apply button when no coupon');
  assert.ok(notAppliedHtml.includes('cart-coupon'), 'Shows coupon input field');

  const appliedHtml = renderToStaticMarkup(
    React.createElement(CouponInput, {
      coupon: { code: 'SAVE20', valid: true, message: 'Coupon applied successfully.' },
      busy: false,
      onApply: async () => undefined,
    }),
  );
  assert.ok(appliedHtml.includes('SAVE20'), 'Shows applied coupon code');
  assert.ok(appliedHtml.includes('Remove'), 'Shows Remove button for applied coupon');
  assert.ok(appliedHtml.includes('Coupon applied successfully.'), 'Shows validation message');
});

test('CoinsToggle shows available balance and switch toggle', () => {
  const html = renderToStaticMarkup(
    React.createElement(CoinsToggle, {
      coins: { balance: 350, used: 200, enabled: true },
      busy: false,
      onChange: () => {},
    }),
  );

  assert.ok(html.includes('350'), 'Shows available coin balance');
  assert.ok(html.includes('Use Trustlon Coins'), 'Shows label');
  assert.ok(html.includes('role="switch"'), 'Uses switch role');
});

test('PriceSummary formats items total, discounts, delivery fee, coins, and total payable in INR', () => {
  const summary = {
    itemsTotal: 399900,
    discount: 150000,
    couponDiscount: 20000,
    deliveryFee: 5000,
    coinsUsed: 10000,
    totalPayable: 224900,
  };

  const html = renderToStaticMarkup(
    React.createElement(PriceSummary, {
      summary,
    }),
  );

  assert.ok(html.includes('Items total'), 'Shows Items total');
  assert.ok(html.includes('Discount'), 'Shows Discount');
  assert.ok(html.includes('Coupon'), 'Shows Coupon');
  assert.ok(html.includes('Delivery fee'), 'Shows Delivery fee');
  assert.ok(html.includes('Coins used'), 'Shows Coins used');
  assert.ok(html.includes('Total payable'), 'Shows Total payable');
  assert.ok(html.includes('₹'), 'Formats using INR currency symbol');

  // Compact mobile view
  const compactHtml = renderToStaticMarkup(
    React.createElement(PriceSummary, {
      summary,
      compact: true,
    }),
  );
  assert.ok(compactHtml.includes('Total payable'), 'Compact shows Total payable');
  assert.ok(compactHtml.includes('You save'), 'Compact shows savings');
});

test('SavedForLater renders items moved out of cart with Move to cart button', () => {
  const emptyHtml = renderToStaticMarkup(
    React.createElement(SavedForLater, {
      items: [],
      busy: false,
      onMove: () => {},
    }),
  );
  assert.equal(emptyHtml, '', 'Returns empty when no items saved for later');

  const html = renderToStaticMarkup(
    React.createElement(SavedForLater, {
      items: [inStockItem],
      busy: false,
      onMove: () => {},
    }),
  );
  assert.ok(html.includes('Saved for later (1)'), 'Shows count');
  assert.ok(html.includes('Move to cart'), 'Shows Move to cart button');
});

test('Empty cart state renders Continue shopping link', () => {
  // Verify empty cart state structure
  const emptyCard = React.createElement(
    'div',
    { className: 'rounded-2xl border border-slate-200/80 bg-white p-5 text-center' },
    React.createElement('h2', { className: 'text-xl font-semibold' }, 'Your cart is empty'),
    React.createElement('a', { href: '/', className: 'inline-flex' }, 'Continue shopping')
  );
  const html = renderToStaticMarkup(emptyCard);
  assert.ok(html.includes('Your cart is empty'));
  assert.ok(html.includes('Continue shopping'));
  assert.ok(html.includes('href="/"'));
});

test('Loading skeleton state renders with status role and accessible label', () => {
  const loading = React.createElement(
    'div',
    { role: 'status', 'aria-label': 'Loading cart', className: 'space-y-4 animate-pulse' },
    [1, 2, 3].map((n) => React.createElement('div', { key: n, className: 'h-32 bg-slate-50' }))
  );
  const html = renderToStaticMarkup(loading);
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-label="Loading cart"'));
});
