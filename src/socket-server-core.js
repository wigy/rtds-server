const clone = require('clone');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const Message = require('./message');
const Middleware = require('./middleware');
const Connection = require('./connection');

/**
 * Socket server keeping records of connections and running middleware handlers for messages.
 */
class SocketServerCore {
  /**
   * @param {Object} config
   * @param {Number} config.PORT
   */
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIO(this.server);
    this.app.use(cors());
    this.connections = {};
    this.registrations = {};
    this.handlers = [];

    this.io.on('connection', (socket) => this.connect(socket));
  }

  /**
   * Establish a connection.
   * @param {Socket} socket
   * @returns {String} The connection ID.
   */
  connect(socket) {
    socket.on('disconnect', () => this.disconnect(socket.id));
    socket.on('message', (type, data) => this.onMessage(socket, type, data));
    this.connections[socket.id] = new Connection(this, socket);
    console.log('Client', socket.id, socket.request.connection.remoteAddress, 'connected.');
    return socket.id;
  }

  /**
   * Demolish the connection.
   * @param {String} clientId
   */
  disconnect(clientId) {
    console.log('Client', clientId, 'disconnected.');
    delete this.connections[clientId];
    Object.keys(this.registrations).forEach((channel) => this.registrations[channel].delete(clientId));
  }

  /**
   * Register a connection as a listener for changes in the channel.
   */
  register(channel, connection) {
    this.registrations[channel] = this.registrations[channel] || new Set();
    this.registrations[channel].add(connection);
  }

  /**
   * Unregister a connection from listeners for changes in the channel.
   */
  unregister(channel, connection) {
    if (this.registrations[channel]) {
      this.registrations[channel].delete(connection);
    }
  }

  /**
   * Get a set of listener connections for the given channel.
   * @param {String} channel
   * @returns {Set<Connection>}
   */
  listeners(channel) {
    return this.registrations[channel] || new Set();
  }

  /**
   * Construct a message and run middleware.
   * @param {Socket} socket
   * @param {String} type
   * @param {Object} data
   */
  async onMessage(socket, type, data = {}) {
    const req = new Message({ server: this, socket, connection: this.connections[socket.id], type, data });
    await this.handle(req, 0);
    return req;
  }

  /**
   * Run numbered middleware for a message.
   * @param {Message} req
   * @param {Number} index
   */
  async handle(req, index, err = null) {
    // Check if all handlers done.
    if (index >= this.handlers.length) {
      // Unhandled error, throw it.
      if (err) {
        throw err;
      }
      return;
    }

    // If this handler does not handle requests like this, just go to the next one.
    if (this.handlers[index].canHandle(req)) {
      if (err) {
        // Running error handlers.
        return this.handlers[index].run(req, async (newErr = null) => {
          if (newErr) {
            console.error(newErr);
            throw new Error('Error handler middleware returned an error.');
          } else {
            await this.handle(req, index + 1, err);
          }
        }, err);
      } else {
        // Running normal handlers.
        return this.handlers[index].run(req, async (newErr = null) => {
          if (newErr) {
            req.error = newErr;
            await this.handle(req, 0, newErr);
          } else {
            await this.handle(req, index + 1, err);
          }
        }, err);
      }
    }

    return this.handle(req, index + 1, err);
  }

  /**
   * Register a handler middleware.
   * @param {null|String|Function|RegExp} [filter]
   * @param {Function<Message, Function>} middleware
   */
  use(filter, middleware = null) {
    if (middleware === null) {
      this.handlers.push(new Middleware(filter, null));
    } else {
      this.handlers.push(new Middleware(middleware, filter));
    }
  }

  /**
   * Register a handler middleware and put it to the front of the list.
   * @param {null|String|Function|RegExp} [filter]
   * @param {Function<Message, Function>} middleware
   */
  useFirst(filter, middleware = null) {
    if (middleware === null) {
      this.handlers.splice(0, 0, new Middleware(filter, null));
    } else {
      this.handlers.push(0, 0, new Middleware(middleware, filter));
    }
  }

  /**
   * Add dumping of the messages.
   */
  useDebug() {
    this.useFirst((req, next) => {
      const out = clone(req.data);
      if (out.password) {
        out.password = 'XXXXXX';
      }
      if (out.token) {
        out.token = 'XXXXXX';
      }
      console.log(req.socket.id, req.type, out);
      next();
    });
  }

  /**
   * Add a handler that sends error if no handler has ended the chain earlier.
   */
  use404() {
    this.use((req) => {
      req.socket.emit('failure', {status: 404, message: `No handler for the message type '${req.type}'.`});
    });
  }

  /**
   * Launch the socket server.
   */
  run() {
    console.log(`Listening on port ${this.config.PORT}.`);
    this.server.listen(this.config.PORT);
  }
}

module.exports = SocketServerCore;
