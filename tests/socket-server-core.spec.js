const assert = require('assert');
const { SocketServerCore } = require('../src');

describe('socket server core', () => {
  it('can use different message filters', async () => {
    const server = new SocketServerCore({}, {log: () => null});
    server.use((req, next) => { req.any = true; next(); });
    server.use('foo', (req, next) => { req.foo = true; next(); });
    server.use(/^bar/, (req, next) => { req.bar = true; next(); });
    server.use((req) => req.data.z === 99, (req, next) => { req.z99 = true; next(); });

    let req = await server.onMessage({}, 'hello', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = await server.onMessage({}, 'foo', {z: 99});
    assert(req.any);
    assert(req.foo);
    assert(!req.bar);
    assert(req.z99);

    req = await server.onMessage({}, 'bar-started', {z: 99});
    assert(req.any);
    assert(!req.foo);
    assert(req.bar);
    assert(req.z99);

    req = await server.onMessage({}, 'z98', {z: 98});
    assert(req.any);
    assert(!req.foo);
    assert(!req.bar);
    assert(!req.z99);
  });

  it('can runs async handlers', async () => {
    const server = new SocketServerCore();
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits = ['HIT 1']; await next(); resolve(); }, 100);
    }));
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits.push('HIT 2'); await next(); resolve(); }, 55);
    }));
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits.push('HIT 3'); await next(); resolve(); }, 150);
    }));
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits.push('HIT 4'); await next(); resolve(); }, 5);
    }));
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits.push('HIT 5'); await next(); resolve(); }, 0);
    }));
    server.use(async (req, next) => new Promise((resolve) => {
      setTimeout(async () => { req.hits.push('HIT 6'); await next(); resolve(); }, 50);
    }));
    const req = await server.onMessage({}, 'test');
    assert.deepStrictEqual(req.hits, ['HIT 1', 'HIT 2', 'HIT 3', 'HIT 4', 'HIT 5', 'HIT 6']);
  });

  it('can handle errors', async () => {
    const server = new SocketServerCore();
    server.use('type1', (req, next) => {
      req.visits = ['handler 1'];
      next();
    });
    server.use('type1', (req, next, err) => {
      if (err) {
        req.visits.push('error handler 2');
        return;
      }
      req.visits.push('handler 2');
      next();
    });
    server.use('type1', (req, next) => {
      req.visits.push('handler 3');
      next('Failed');
    });
    server.use('type1', (req, next) => {
      req.visits.push('handler 4');
      next();
    });
    const req = await server.onMessage({}, 'type1');
    assert.deepStrictEqual(req.visits, ['handler 1', 'handler 2', 'handler 3', 'error handler 2']);
  });

  it('can handle exceptions', async () => {
    const server = new SocketServerCore();
    server.use('type1', (req, next) => {
      req.visits = ['handler 1'];
      throw new Error('Catch me');
    });
    server.use('type1', (req, next, err) => {
      if (err) {
        req.visits.push('error handler 2');
        return;
      }
      req.visits.push('handler 2');
      next();
    });
    const req = await server.onMessage({}, 'type1');
    assert.deepStrictEqual(req.visits, ['handler 1', 'error handler 2']);
  });
});
