/**
 * A description of a connection.
 */
class Connection {
  constructor(socket) {
    this.socket = socket;
    this.id = socket.id;
    this.subscriptions = {};
  }
}

module.exports = Connection;
