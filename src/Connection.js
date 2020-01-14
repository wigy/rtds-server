const Subscription = require('./Subscription');
const Filter = require('./Filter');

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
   * Find the index of the channel and filter in the subscription list or -1 if not found.
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
   * Find the corresponding subscription or throw an error.
   * @param {String} channelName
   * @param {Filter} filter
   */
  subscription(channelName, filter) {
    const idx = this.indexOf(channelName, filter);
    if (idx < 0) {
      throw new Error(`Unable to find subscription for channel '${channelName}' with filter '${filter}'.`);
    }
    return this.subscriptions[channelName][idx];
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
    const sub = new Subscription(channel, filter, this);
    this.server.register(channelName, this);
    this.subscriptions[channelName].push(sub);
    this.server.addSubscription(sub);
    channel.subscribe(this, sub);

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
      channel.unsubscribe(this, this.subscriptions[channelName][idx]);
      this.server.dropSubscription(this.subscriptions[channelName][idx]);
      this.subscriptions[channelName].splice(idx, 1);
      if (this.subscriptions[channelName].length === 0) {
        this.server.unregister(channelName, this);
      }
      return true;
    }
    return false;
  }

  /**
   * Hook that is called when client has been disconnected.
   */
  disconnect() {
    Object.entries(this.subscriptions).forEach(([channelName, subs]) => {
      subs.forEach(sub => {
        this.server.dropSubscription(sub);
      });
    });
  }

  /**
   * Record the primary keys from the latest read for the particular channel.
   * @param {Channel} channel
   * @param {Filter} filter
   * @param {Object<Set<Number>>>} pks
   */
  updateLatestRead(channel, filter, pks) {
    const sub = this.subscription(channel.name, filter);
    sub.updateLatestRead(pks);
    this.server.updateDependency(sub, pks);
  }
}

module.exports = Connection;
