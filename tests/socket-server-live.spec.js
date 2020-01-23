const sinon = require('sinon');
const path = require('path');
const assert = require('assert');
const { SocketServerLive, Message } = require('../src');
const { Driver } = require('rtds-query');

// If set, show messages from server.
const DEBUG = false;

// Helper to make a brief pause to wait for emitted events to propagate.
const briefPause = async (delay) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delay);
  });
};

describe('socket server live', async () => {
  const DATABASE_URL = process.env.DATABASE_URL || `sqlite:///${__dirname}/test.sqlite`;
  const driver = Driver.create(DATABASE_URL);

  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJTdGFrZXMiLCJ1c2VyIjp7Im5hbWUiOiJNeSBOYW1lIn0sImlhdCI6MTU3MjUxNjEzOH0.ABOpVLroYKiFcuvtSs2jMB0gMEAJ8nkRDj7P-UazfBA';
  const server = new SocketServerLive(
    {
      SECRET: 'secret123'
    },
    {
      driver,
      auth: (cred) => true,
      log: DEBUG ? (...args) => console.log(...args) : () => {}
    });

  before(async () => {
    await driver.runSqlFile(path.join(__dirname, 'migrations/init.sql'));
    await driver.initialize();

    server.makeChannel('investors', {
      select: ['id', 'name', 'email', 'tag'],
      table: 'investors'
    }, {
      insert: ['id', 'name', 'email', 'tag'],
      table: 'investors'
    }, {
      update: ['name', 'email', 'tag'],
      table: 'investors'
    }, {
      delete: ['id'],
      table: 'investors'
    });
  });

  after(async () => {
    await driver.runSqlFile(path.join(__dirname, 'migrations/exit.sql'));
  });

  const INVESTOR_DATA = [
    { id: 1, name: 'Company A', email: 'a@email.com', tag: 'A' },
    { id: 2, name: 'Company B', email: 'b@email.com', tag: 'B' },
    { id: 3, name: 'Company C', email: 'c@email.com', tag: 'C' }
  ];

  it('updates all clients correctly', async () => {
    const socket1 = {id: 1, on: sinon.spy(), emit: sinon.spy()};
    const socket2 = {id: 2, on: sinon.spy(), emit: sinon.spy()};
    const connection1 = server.connect(socket1);
    const connection2 = server.connect(socket2);

    // Client 1: subscribe all investors.
    await server.subscribe(new Message({server, socket: socket1, connection: connection1, data: {channel: 'investors'}}));
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 2: subscribe all investors.
    await server.subscribe(new Message({server, socket: socket2, connection: connection2, data: {channel: 'investors'}}));
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 1: update the name of the second item.
    INVESTOR_DATA[1].name = 'New inc.';
    await server.onMessage(socket1, 'update-objects', {
      token,
      investors: {id: 2, name: 'New inc.'}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', INVESTOR_DATA]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 2: create new item
    INVESTOR_DATA.push({id: 4, name: 'Fresh inc.', tag: 'F', email: 'f@fresh.com'});
    await server.onMessage(socket1, 'create-objects', {
      token,
      investors: {id: 4, name: 'Fresh inc.', tag: 'F', email: 'f@fresh.com'}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', INVESTOR_DATA]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 1: delete item
    INVESTOR_DATA.splice(3, 1);
    await server.onMessage(socket1, 'delete-objects', {
      token,
      investors: {id: 4}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', INVESTOR_DATA]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 1: unsubscribe investors, re-subscribe with single ID 3.
    await server.unsubscribe(new Message({server, socket: socket1, connection: connection1, data: {channel: 'investors'}}));
    await server.subscribe(new Message({server, socket: socket1, connection: connection1, data: {channel: 'investors', filter: {id: 3}}}));
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', [INVESTOR_DATA[2]]]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 2: update the tag of the third item.
    INVESTOR_DATA[2].tag = 'CC';
    await server.onMessage(socket1, 'update-objects', {
      token,
      investors: {id: 3, tag: 'CC'}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', [INVESTOR_DATA[2]]]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 2: delete the third item.
    INVESTOR_DATA.splice(2, 1);
    await server.onMessage(socket1, 'delete-objects', {
      token,
      investors: {id: 3}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', []]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    // Client 2: create new item.
    INVESTOR_DATA.push({id: 5, name: 'Latest inc.', tag: 'L', email: 'l@late.com'});
    await server.onMessage(socket1, 'create-objects', {
      token,
      investors: {id: 5, name: 'Latest inc.', tag: 'L', email: 'l@late.com'}
    });
    await briefPause(100);
    assert.deepStrictEqual(socket1.emit.lastCall.args, ['investors', []]);
    assert.deepStrictEqual(socket2.emit.lastCall.args, ['investors', INVESTOR_DATA]);

    await briefPause(250);
  });
});
