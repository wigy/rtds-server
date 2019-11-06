const assert = require('assert');
const clone = require('clone');
const sinon = require('sinon');
const { SocketServerSync, Message } = require('../src');

describe('socket server sync', async () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJTdGFrZXMiLCJ1c2VyIjp7Im5hbWUiOiJNeSBOYW1lIn0sImlhdCI6MTU3MjUxNjEzOH0.ABOpVLroYKiFcuvtSs2jMB0gMEAJ8nkRDj7P-UazfBA';
  const server = new SocketServerSync(
    {
      SECRET: 'secret123'
    },
    {
      auth: (cred) => true,
      log: () => null
    });

  it('updates all clients correctly', async () => {
    const store = {
      A: [{id: 1, name: 'A'}, {id: 2, name: 'a'}]
    };
    server.addChannel('channelA', {
      fetch: async () => clone(store.A),
      create: async (data) => {
        store.A.push(data);
        return data;
      },
      affects: async (object) => ['channelA']
    });
    const socket1 = {id: 1, on: sinon.spy(), emit: sinon.spy()};
    const socket2 = {id: 2, on: sinon.spy(), emit: sinon.spy()};
    const connection1 = server.connect(socket1);
    const connection2 = server.connect(socket2);

    const req1 = new Message({server, socket: socket1, connection: connection1, data: {channel: 'channelA'}});
    await server.subscribe(req1);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['channelA', [{id: 1, name: 'A'}, {id: 2, name: 'a'}]]);

    const req2 = new Message({server, socket: socket2, connection: connection2, data: {channel: 'channelA'}});
    await server.subscribe(req2);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['channelA', [{id: 1, name: 'A'}, {id: 2, name: 'a'}]]);

    await server.onMessage(socket1, 'create-objects', {
      token,
      channelA: {name: 'AAA'}
    });
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['channelA', [{id: 1, name: 'A'}, {id: 2, name: 'a'}, {name: 'AAA'}]]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['channelA', [{id: 1, name: 'A'}, {id: 2, name: 'a'}, {name: 'AAA'}]]);
  });
});
