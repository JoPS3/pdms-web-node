const path = require('path');

const runtimePath = path.join(__dirname, '..', 'src', 'config', 'runtime.js');

function loadRuntimeWithBasePath(value) {
  if (value === undefined) {
    delete process.env.BASE_PATH_DEV;
  } else {
    process.env.BASE_PATH_DEV = value;
  }

  jest.resetModules();
  return require(runtimePath);
}

test('runtime normalizeBasePath empty and slash map to empty', () => {
  expect(loadRuntimeWithBasePath('').basePath).toBe('');
  expect(loadRuntimeWithBasePath('/').basePath).toBe('');
  expect(loadRuntimeWithBasePath(undefined).basePath).toBe('');
});

test('runtime normalizeBasePath enforces leading slash and trims trailing slash', () => {
  expect(loadRuntimeWithBasePath('apps/pdms-new').basePath).toBe('/apps/pdms-new');
  expect(loadRuntimeWithBasePath('/apps/pdms-new/').basePath).toBe('/apps/pdms-new');
});
