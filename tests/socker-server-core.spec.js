const assert = require('assert');
const { SocketServerCore } = require('../src');

describe('middleware', () => {
  it('can use different message filters', async () => {
    const test = new SocketServerCore();
    test.use((req, next) => { req.any = true; next();});
    test.use('foo', (req, next) => { req.foo = true; next();});
    test.use(/^bar/, (req, next) => { req.bar = true; next();});
    test.use((req) => req.data.z === 99, (req, next) => { req.z99 = true; next();});

    let req = await test.onMessage({}, 'hello', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = await test.onMessage({}, 'foo', {z: 99});
    assert(req.any);
    assert(req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = await test.onMessage({}, 'bar-started', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(req.bar);
    assert(req.z99);

    req = await test.onMessage({}, 'z98', {z: 98});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(!req.z99);
  });

  it('can runs async handlers', async () => {
    const test = new SocketServerCore();
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits=['HIT 1']; await next(); resolve()}, 100);
    }));
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits.push('HIT 2'); await next(); resolve()}, 55);
    }));
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits.push('HIT 3'); await next(); resolve()}, 150);
    }));
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits.push('HIT 4'); await next(); resolve()}, 5);
    }));
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits.push('HIT 5'); await next(); resolve()}, 0);
    }));
    test.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => {req.hits.push('HIT 6'); await next(); resolve()}, 50);
    }));
    const req = await test.onMessage({}, 'test');
    assert.deepStrictEqual(req.hits, ['HIT 1', 'HIT 2', 'HIT 3', 'HIT 4', 'HIT 5', 'HIT 6']);
  });
});
