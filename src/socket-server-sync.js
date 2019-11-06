const SocketServerAuth = require('./socket-server-auth');

/**
 * Server for handling collection of data with synchronization dependencies.
   * @param {Object} config
   * @param {String} config.SECRET
   * @param {Number} config.PORT
   * @param {Object} hooks
   * @param {Function} hooks.log
   * @param {Function} hooks.auth
 */
class SocketServerSync extends SocketServerAuth {
  constructor(config, {
    auth = async (_cred) => false,
    log = (type, ...msg) => console.log(`[${type}]`, ...msg)
  } = {}) {
    super(config, { auth, log });
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
  addChannel(channel, { fetch, create, affects }) {
    if (this.channels[channel]) {
      throw new Error(`Channel ${channel} already defined.`);
    }
    this.channels[channel] = { fetch, create, affects };
  }

  /**
   * Get the list of all channels.
   * @returns {String[]}
   */
  getChannels() {
    return Object.keys(this.channels);
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
    const sub = req.connection.subscribe(channel, filter || null);
    const res = await this.fetchObjects(req, channel, sub.filter);
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
    const object = await this.channels[channel].create(data);
    return { channel, object };
  }

  /**
   * Handler for object creation requests.
   * @param {Message} req
   */
  async createObjects(req) {
    const results = [];
    for (const [k, v] of Object.entries(req.data)) {
      if (k === 'token') {
        continue;
      }
      if (v instanceof Array) {
        for (const data of v) {
          results.push(await this.createObject(req, k, data));
        }
      } else if (v instanceof Object) {
        results.push(await this.createObject(req, k, v));
      } else {
        this.hooks.log('error', `Invalid object initialization ${JSON.stringify(v)} for ${k}.`);
      }
    }
    await this.synchronize(req, results);
  }

  /**
   * Get the idea of channels that changed object affects.
   * @param {Message} req
   * @param {Object} object
   * @param {String} channel
   */
  async affects(req, { object, channel }) {
    if (!this.channels[channel].affects) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support dependency checking.`});
      return;
    }
    const ret = await this.channels[channel].affects(object);
    return ret;
  }

  /**
   * Scan for all listeners that needs update for the changed objects.
   * @param {Object[]} objects
   * @param {String} objects[].channel
   * @param {Object} objects[].object
   *
   * Note: default synchronization is not efficient for bigger number of objects.
   * It is recommended to write custom versions in sub-class that takes into account
   * domain specific short-cuts.
   */
  async synchronize(req, objects) {
    const handled = new Set();
    for (const item of objects) {
      for (const channel of await this.affects(req, item)) {
        // Handle each channel on first encounter and skip the rest.
        if (!handled.has(channel)) {
          handled.add(channel);
          const cache = {};
          // Go through filters established per connection.
          for (const conn of req.server.listeners(channel)) {
            for (const filter of conn.filters(channel)) {
              // Cache results.
              if (!(filter.name in cache)) {
                cache[filter.name] = await this.fetchObjects(req, channel, filter);
              }
              conn.socket.emit(channel, cache[filter.name]);
            }
          }
        }
      }
    }
  }
}

module.exports = SocketServerSync;
