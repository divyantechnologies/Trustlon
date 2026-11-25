const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const base = path.join(__dirname, '../src/features/local');
function load(file, overrides = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    URLSearchParams,
    Error,
    AbortController,
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name === '../query') return query;
      return require(name);
    },
  });
  return exports;
}
const query = load('query.ts');
const controls = {
  Button: 'button',
  Dialog: 'dialog',
  TextField: 'input',
  cn: (...values) => values.filter(Boolean).join(' '),
  focusRing: 'focus-visible:ring-2',
};
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate)),
  ];
}

test('location validation rejects malformed pincodes without converting them', () => {
  for (const value of [
    '',
    '12345',
    '1234567',
    '024001',
    '24400a',
    '244 01',
    ' 244001',
    '２４４００１',
  ]) {
    assert.ok(query.pincodeError(value), value);
  }
  assert.equal(query.pincodeError('244001'), undefined);
});

test('radius defaults to 10 and URL values round-trip', () => {
  for (const value of [null, '', '0', '7', '1e1', '-5']) assert.equal(query.parseRadius(value), 10);
  for (const radius of query.RADII) {
    const url = new URL(query.localUrl('244001', radius), 'http://example.test');
    assert.equal(url.searchParams.get('pincode'), '244001');
    assert.equal(query.parseRadius(url.searchParams.get('radius')), radius);
  }
  assert.equal(query.largerRadius(5), 10);
  assert.equal(query.largerRadius(10), 25);
  assert.equal(query.largerRadius(25), null);
});

test('DistanceFilter renders labelled, single-select radio controls and calls onChange', () => {
  const { DistanceFilter } = load('components/DistanceFilter.tsx', { '@/design-system': controls });
  const selected = [];
  const tree = DistanceFilter({ value: 10, onChange: (value) => selected.push(value) });
  const radios = nodes(tree, (node) => node.type === 'input');
  assert.deepEqual(
    radios.map((node) => node.props.value),
    [5, 10, 25],
  );
  assert.deepEqual(
    radios.map((node) => node.props.checked),
    [false, true, false],
  );
  radios[2].props.onChange();
  assert.deepEqual(selected, [25]);
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /aria-label="Within 25 km"/);
  assert.match(markup, /peer-focus-visible:ring-2/);
  assert.match(markup, /name="local-radius"/);
});

test('LocationBar submit shows inline errors, saves valid values, and retains failures for retry', async () => {
  // Drive the component's own handlers with a tiny hook harness, using the existing Node runner.
  const state = [];
  let cursor = 0;
  let fail = false;
  const saved = [],
    opened = [];
  const { LocationBar } = load('components/LocationBar.tsx', {
    '@/design-system': controls,
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [
          state[index],
          (value) => {
            state[index] = value;
          },
        ];
      },
    },
  });
  const render = () => {
    cursor = 0;
    return LocationBar({
      pincode: '244001',
      open: true,
      signedIn: true,
      onOpenChange: (value) => opened.push(value),
      onSave: async (value) => {
        if (fail) throw new Error('Save failed');
        saved.push(value);
      },
    });
  };
  const input = (tree) => nodes(tree, (node) => node.type === 'input')[0];
  const submit = (tree) =>
    nodes(tree, (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  input(render()).props.onChange({ target: { value: '024001' } });
  await submit(render());
  assert.ok(input(render()).props.error);
  assert.equal(saved.length, 0);
  input(render()).props.onChange({ target: { value: '244001' } });
  await submit(render());
  assert.deepEqual(saved, ['244001']);
  assert.equal(opened.at(-1), false);
  fail = true;
  await submit(render());
  assert.equal(input(render()).props.error, 'Save failed');
  assert.equal(input(render()).props.disabled, false);
});

test('an aborted location request cannot update items even if the transport resolves late', async () => {
  const state = [];
  let cursor = 0,
    cleanup,
    resolve;
  const { useLocalPage } = load('use-local-page.ts', {
    react: {
      useState(initial) {
        const index = cursor++;
        state[index] = initial;
        return [
          initial,
          (value) => {
            state[index] = typeof value === 'function' ? value(state[index]) : value;
          },
        ];
      },
      useEffect(effect) {
        cleanup = effect();
      },
    },
  });
  let signal;
  useLocalPage(
    (_pin, _radius, _page, requestSignal) => {
      signal = requestSignal;
      return new Promise((done) => {
        resolve = done;
      });
    },
    '244001',
    10,
  );
  cleanup();
  assert.equal(signal.aborted, true);
  resolve({ items: [{ id: 'stale' }], totalPages: 1, serviceable: true });
  await new Promise((done) => setImmediate(done));
  assert.equal(state[0].length, 0);
});
