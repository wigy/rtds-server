// TODO: Rename class files upper-case.
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
   */
  subscribe(connection) {
  }

  /**
   * Hook that is called when client unsubscribes from this channel.
   * @param {Connection} connection
   */
  unsubscribe(connection) {
  }
}

module.exports = Channel;
