const assert = require('assert');
const { SocketServerCore } = require('../src');

describe('middleware', () => {
  it('can use different message filters', () => {
    const test = new SocketServerCore();
    test.use((req, next) => { req.any = true; next();});
    test.use('foo', (req, next) => { req.foo = true; next();});
    test.use(/^bar/, (req, next) => { req.bar = true; next();});
    test.use((req) => req.data.z === 99, (req, next) => { req.z99 = true; next();});

    let req = test.onMessage({}, 'hello', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = test.onMessage({}, 'foo', {z: 99});
    assert(req.any);
    assert(req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = test.onMessage({}, 'bar-started', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(req.bar);
    assert(req.z99);

    req = test.onMessage({}, 'z98', {z: 98});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(!req.z99);
  });
});
