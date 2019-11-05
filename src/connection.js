const Subscription = require('./subscription');
const Filter = require('./filter');

/**
 * A description of a connection.
 */
class Connection {
  constructor(server, socket) {
    this.server = server;
    this.socket = socket;
    this.id = socket.id;
    this.subscriptions = {};
  }

  /**
   * Get the list of filters listening the channel.
   * @param {String} channel
   */
  filters(channel) {
    return this.subscriptions[channel]
      ? this.subscriptions[channel].map(s => s.filter)
      : [];
  }

  /**
   * Find the index of the channel in the list or -1 if not found.
   * @param {String} channel
   * @param {null|Object} filter
   */
  indexOf(channel, filter) {
    if (!this.subscriptions[channel]) {
      return -1;
    }
    return this.subscriptions[channel].findIndex(sub => sub.filter.isSame(filter));
  }

  /**
   * Subscribe to the data sync channel.
   * @param {String} channel
   * @param {null|Object|Filter} filter
   * @returns {Subscription}
   */
  subscribe(channel, filter = null) {
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    this.subscriptions[channel] = this.subscriptions[channel] || [];
    const idx = this.indexOf(channel, filter);
    if (idx >= 0) {
      return this.subscriptions[channel][idx];
    }
    const sub = new Subscription(channel, filter);
    this.server.register(channel, this);
    this.subscriptions[channel].push(sub);
    return sub;
  }

  /**
   * Unsubscribe from the data sync channel.
   * @param {String} channel
   * @param {null|Object} filter
   */
  unsubscribe(channel, filter = null) {
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    const idx = this.indexOf(channel, filter);
    if (idx >= 0) {
      this.subscriptions[channel].splice(idx, 1);
      if (this.subscriptions[channel].length === 0) {
        this.server.unregister(channel, this);
      }
      return true;
    }
    return false;
  }
}

module.exports = Connection;
