const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const runtimePath = path.join(__dirname, '..', 'src', 'config', 'runtime.js');

function loadRuntimeWithBasePath(value) {
  if (value === undefined) {
    delete process.env.BASE_PATH_DEV;
  } else {
    process.env.BASE_PATH_DEV = value;
  }

  delete require.cache[require.resolve(runtimePath)];
  return require(runtimePath);
}

test('runtime normalizeBasePath empty and slash map to empty', () => {
  assert.equal(loadRuntimeWithBasePath('').basePath, '');
  assert.equal(loadRuntimeWithBasePath('/').basePath, '');
  assert.equal(loadRuntimeWithBasePath(undefined).basePath, '');
});

test('runtime normalizeBasePath enforces leading slash and trims trailing slash', () => {
  assert.equal(loadRuntimeWithBasePath('apps/pdms-new').basePath, '/apps/pdms-new');
  assert.equal(loadRuntimeWithBasePath('/apps/pdms-new/').basePath, '/apps/pdms-new');
});
