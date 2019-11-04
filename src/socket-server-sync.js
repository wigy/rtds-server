const SocketServerAuth = require('./socket-server-auth');

/**
 * Server for handling collection of data with synchronization dependencies.
 */
class SocketServerSync extends SocketServerAuth {
  constructor(config, auth) {
    super(config, auth);
    this.channels = {};
    this.use('subscribe', async (req) => this.subscribe(req));
    this.use('unsubscribe', async (req) => this.unsubscribe(req));
    this.use('create-objects', async (req) => this.createObjects(req));
  }

  /**
   * Define a new channel and its handler functions.
   * @param {String} channel
   * @param {Object} param1
   */
  addChannel(channel, { fetch, create }) {
    if (this.channels[channel]) {
      throw new Error(`Channel ${channel} already defined.`);
    }
    this.channels[channel] = { fetch, create }
  }

  /**
   * Handler for a request to subscribe to the channel.
   * @param {Message} req
   */
  async subscribe(req) {
    const { channel, filter } = req.data;
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    req.connection.subscribe(channel, filter || null);
    const res = await this.fetchObjects(req, channel, filter);
    req.socket.emit(channel, res);
  }

  /**
   * Handler for a request to unsubscribe from the channel.
   * @param {Message} req
   */
  async unsubscribe(req) {
    const { channel, filter } = req.data;
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    req.connection.unsubscribe(channel, filter || null);
  }

  /**
   * Fetch objects matching the filter.
   * @param {Message} req
   * @param {String} channel
   * @param {Object} filter
   */
  async fetchObjects(req, channel, filter) {
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    if (!this.channels[channel].fetch) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support object fetching.`});
      return;
    }
    const data = await this.channels[channel].fetch(filter);
    return data;
  }

  /**
   * Helper to handle single object creation.
   * @param {Message} req
   * @param {String} channel
   * @param {Object} data
   */
  async createObject(req, channel, data) {
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    if (!this.channels[channel].create) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support object creation.`});
      return;
    }
    const newObject = await this.channels[channel].create(data);
    // TODO: Resolve channel and filter dependencies.
    for (const conn of req.server.listeners(channel)) {
      for (const filter of conn.filters(channel)) {
        console.log('Debug: Refreshing', conn.id, channel, filter);
        const data = await this.fetchObjects(req, channel, filter);
        conn.socket.emit(channel, data);
      }
    }
  }

  /**
   * Handler for object creation requests.
   * @param {Message} req
   */
  async createObjects(req) {
    for (const [k, v] of Object.entries(req.data)) {
      if (k === 'token') {
        continue;
      }
      if (v instanceof Array) {
        for (data of v) {
          await this.createObject(req, k, data);
        }
      } else if (v instanceof Object) {
        await this.createObject(req, k, v);
      } else {
        console.error(`Invalid object initialization ${JSON.stringify(v)} for ${k}.`);
      }
    }
  }
}

module.exports = SocketServerSync;
