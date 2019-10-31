const assert = require('assert');
const jwt = require('jsonwebtoken');
const { SocketServerAuth } = require('../src');

describe('socket server auth', () => {
  const server = new SocketServerAuth(
    {SECRET: 'secret123'},
    (auth) => {
      if (auth.user === 'me') {
        return {name: 'My Name'};
      }
    },
    (err) => {});

  it('can separate valid and invalid user', async () => {
    req = await server.onMessage({emit: () => {}}, 'login', {user: 'me'});
    assert(!req.error);
    req = await server.onMessage({emit: () => {}}, 'login', {user: 'someone'});
    assert(req.error);
  });

  it('sends token on success', (done) => {
    server.onMessage({emit: (type, data) => {
      assert(type === 'welcome');
      assert(data.token);
      assert(data.user.name === 'My Name');
      const decoded = jwt.decode(data.token);
      assert(decoded.user.name === 'My Name');
      done();
    }}, 'login', {user: 'me'});
  });

  it('sends error on failure', (done) => {
    server.onMessage({emit: (type, data) => {
      assert(type === 'error');
      assert(data.status);
      assert(data.message);
      done();
    }}, 'login', {user: 'wrong'});
  });

  it('accepts messages with correct token', async () => {
    let token;
    await server.onMessage({emit: (type, data) => {
      if (type === 'welcome') {
        token = data.token;
      }
    }}, 'login', {user: 'me'});
    const req = await server.onMessage({emit: (type, data) => {
      if (type === 'error') {
        assert.fail();
      }
    }}, 'test', { token });
    assert(req.user);
    assert(req.user.name === 'My Name');
  });

  it('denies messages with missing or incorrect token', async () => {
    server.use('pass', (req) => req.passed = true);
    let req = await server.onMessage({emit: () => {}}, 'pass');
    assert(!req.passed);
    req = await server.onMessage({emit: () => {}}, 'pass', {token: 'BAD'});
    assert(!req.passed);
    // Verify test with valid token.
    req = await server.onMessage({emit: () => {}}, 'pass', {token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJTdGFrZXMiLCJ1c2VyIjp7Im5hbWUiOiJNeSBOYW1lIn0sImlhdCI6MTU3MjUxNjEzOH0.ABOpVLroYKiFcuvtSs2jMB0gMEAJ8nkRDj7P-UazfBA'});
    assert(req.passed);
  });
});
