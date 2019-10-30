/**
 * A message received from the socket.
 */
class Message {
  constructor({ socket, connection, type, data }) {
    this.socket = socket;
    this.type = type;
    this.data = data;
    this.connection = connection;
  }
}

module.exports = Message;
