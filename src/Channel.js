/**
 * A channel handling operations for one group of items.
 */
class Channel {
  constructor(name, { create, read, update, del, affects }) {
    this.name = name;
    this.create = create;
    this.read = read;
    this.update = update;
    this.del = del;
    this.affects = affects;
  }

  /**
   * Hook that is called when client subscribes to this channel.
   * @param {Connection} connection
   * @param {Subscription} subscription
   */
  subscribe(connection, subscription) {
  }

  /**
   * Hook that is called when client unsubscribes from this channel.
   * @param {Connection} connection
   * @param {Subscription} subscription
   */
  unsubscribe(connection, subscription) {
  }
}

module.exports = Channel;
