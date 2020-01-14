const SocketServerAuth = require('./SocketServerAuth');
const Channel = require('./Channel');

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
    this.use('subscribe-channel', async (req) => this.subscribe(req));
    this.use('unsubscribe-channel', async (req) => this.unsubscribe(req));
    this.use('create-objects', async (req) => this.createObjects(req));
    this.use('update-objects', async (req) => this.updateObjects(req));
    this.use('delete-objects', async (req) => this.deleteObjects(req));
  }

  /**
   * Define a new channel and its handler functions.
   * @param {String} channel
   * @param {Object} hooks
   * @param {Function} hooks.read
   * @param {Function} hooks.create
   * @param {Function} hooks.update
   * @param {Function} hooks.affects
   */
  addChannel(channel, { create, read, update, del, affects }) {
    if (this.channels[channel]) {
      throw new Error(`Channel ${channel} already defined.`);
    }
    this.channels[channel] = new Channel(channel, { create, read, update, del, affects });
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
    const sub = req.connection.subscribe(this.channels[channel], filter || null);
    const res = await this.readObjects(req, channel, sub.filter);
    req.socket.emit(channel, res);
  }

  /**
   * Hook to be called when new subscription has been created.
   * @param {Subscription} sub
   */
  addSubscription(sub) {
  }

  /**
   * Hook to be called when a subscription is about to be dropped.
   * @param {Subscription} sub
   */
  dropSubscription(sub) {
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
    req.connection.unsubscribe(this.channels[channel], filter || null);
  }

  /**
   * Fetch objects matching the filter.
   * @param {Message} req
   * @param {String} channel
   * @param {Object} filter
   */
  async readObjects(req, channel, filter) {
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    if (!this.channels[channel].read) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support object reading.`});
      return;
    }
    const data = await this.channels[channel].read(filter, req);
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
    const object = await this.channels[channel].create(data, req);
    return { channel, object };
  }

  /**
   * Handler for object creation requests.
   * @param {Message} req
   */
  async createObjects(req) {
    const results = [];
    for (const [channel, values] of Object.entries(req.data)) {
      if (channel === 'token') {
        continue;
      }
      if (values instanceof Array) {
        for (const data of values) {
          results.push(await this.createObject(req, channel, data));
        }
      } else if (values instanceof Object) {
        results.push(await this.createObject(req, channel, values));
      } else {
        this.hooks.log('error', `Invalid object initialization ${JSON.stringify(values)} for ${channel}.`);
      }
    }
    await this.synchronize(req, results, 'create');
  }

  /**
   * Helper to handle single object update.
   * @param {Message} req
   * @param {String} channel
   * @param {Object} data
   */
  async updateObject(req, channel, data) {
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    if (!this.channels[channel].update) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support object updates.`});
      return;
    }
    const object = await this.channels[channel].update(data, req);
    return { channel, object };
  }

  /**
   * Handler for object update requests.
   * @param {Message} req
   */
  async updateObjects(req) {
    const results = [];
    // TODO: DRY
    for (const [channel, values] of Object.entries(req.data)) {
      if (channel === 'token') {
        continue;
      }
      if (values instanceof Array) {
        for (const data of values) {
          results.push(await this.updateObject(req, channel, data));
        }
      } else if (values instanceof Object) {
        results.push(await this.updateObject(req, channel, values));
      } else {
        this.hooks.log('error', `Invalid object update ${JSON.stringify(values)} for ${channel}.`);
      }
    }
    await this.synchronize(req, results, 'update');
  }

  /**
   * Helper to handle single object deletion.
   * @param {Message} req
   * @param {String} channel
   * @param {Object} data
   */
  async deleteObject(req, channel, data) {
    if (!this.channels[channel]) {
      req.socket.emit('failure', {status: 404, message: `No such channel as '${channel}'.`});
      return;
    }
    if (!this.channels[channel].del) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support object deletion.`});
      return;
    }
    const object = await this.channels[channel].del(data, req);
    return { channel, object };
  }

  /**
   * Handler for object delete requests.
   * @param {Message} req
   */
  async deleteObjects(req) {
    const results = [];
    // TODO: DRY
    for (const [channel, values] of Object.entries(req.data)) {
      if (channel === 'token') {
        continue;
      }
      if (values instanceof Array) {
        for (const data of values) {
          results.push(await this.deleteObject(req, channel, data));
        }
      } else if (values instanceof Object) {
        results.push(await this.deleteObject(req, channel, values));
      } else {
        this.hooks.log('error', `Invalid object delete filter ${JSON.stringify(values)} for ${channel}.`);
      }
    }
    await this.synchronize(req, results, 'delete');
  }

  /**
   * Get the idea of channels that changed object affects.
   * @param {Message} req
   * @param {Object} object
   * @param {String} channel
   */
  async affects(req, { channel, object }) {
    if (!this.channels[channel].affects) {
      req.socket.emit('failure', {status: 400, message: `Channel '${channel}' does not support dependency checking.`});
      return;
    }
    const ret = await this.channels[channel].affects(object);
    return ret;
  }

  /**
   * Scan for all listeners that needs update for the changed objects.
   * @param {Message} req
   * @param {Object[]} objects
   * @param {String} event Either 'create', 'update' or 'delete'.
   * @param {String} objects[].channel
   * @param {Object} objects[].object
   *
   * Note: default synchronization is not efficient for bigger number of objects.
   * It is recommended to write custom versions in sub-class that takes into account
   * domain specific short-cuts.
   */
  async synchronize(req, objects, event) {
    const handled = new Set();
    for (const item of objects) {
      if (item === undefined) {
        continue;
      }
      const affects = await this.affects(req, item);
      if (!affects) {
        throw new Error(`Got invalid response ${JSON.stringify(affects)} from affects().`);
      }
      for (const channel of affects) {
        // Handle each channel on first encounter and skip the rest.
        if (!handled.has(channel)) {
          handled.add(channel);
          const cache = {};
          // Go through filters established per connection.
          for (const conn of req.server.listeners(channel)) {
            for (const filter of conn.filters(channel)) {
              // Cache results.
              if (!(filter.name in cache)) {
                cache[filter.name] = await this.readObjects(req, channel, filter);
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
