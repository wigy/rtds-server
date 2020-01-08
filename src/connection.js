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
   * @param {String} channelName
   */
  filters(channelName) {
    return this.subscriptions[channelName]
      ? this.subscriptions[channelName].map(s => s.filter)
      : [];
  }

  /**
   * Find the index of the channel in the list or -1 if not found.
   * @param {String} channelName
   * @param {null|Object} filter
   */
  indexOf(channelName, filter) {
    if (!this.subscriptions[channelName]) {
      return -1;
    }
    return this.subscriptions[channelName].findIndex(sub => sub.filter.isSame(filter));
  }

  /**
   * Subscribe to the data sync channel.
   * @param {Channel} channel
   * @param {null|Object|Filter} filter
   * @returns {Subscription}
   */
  subscribe(channel, filter = null) {
    const channelName = channel.name;
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    this.subscriptions[channelName] = this.subscriptions[channelName] || [];
    const idx = this.indexOf(channelName, filter);
    if (idx >= 0) {
      return this.subscriptions[channelName][idx];
    }
    const sub = new Subscription(channelName, filter);
    this.server.register(channelName, this);
    this.subscriptions[channelName].push(sub);
    channel.subscribe(this);

    return sub;
  }

  /**
   * Unsubscribe from the data sync channel.
   * @param {Channel} channel
   * @param {null|Object} filter
   */
  unsubscribe(channel, filter = null) {
    const channelName = channel.name;
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    const idx = this.indexOf(channelName, filter);
    if (idx >= 0) {
      this.subscriptions[channelName].splice(idx, 1);
      if (this.subscriptions[channelName].length === 0) {
        this.server.unregister(channelName, this);
      }
      channel.unsubscribe(this);
      return true;
    }
    return false;
  }

  /**
   * Record the latest read for the particular channel.
   * @param {Channel} channel
   * @param {String} filter
   * @param {Object<Set<Number>>>} pks
   */
  updateLatestRead(channel, filter, pks) {
    console.log('UPDATE CHANNEL', channel, filter, pks);
  }
}

module.exports = Connection;
