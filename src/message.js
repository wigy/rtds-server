/**
 * A message received from the socket.
 */
class Message {
  constructor({ server, socket, connection, type, data }) {
    this.server = server;
    this.socket = socket;
    this.type = type;
    this.data = data;
    this.connection = connection;
    this.error = null;
  }
}

module.exports = Message;
