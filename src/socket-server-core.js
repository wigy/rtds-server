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
    this.handlers = [];

    this.io.on('connection', (socket) => {
      socket.on('disconnect', () => {
        console.log('Client', socket.request.connection.remoteAddress, 'disconnected.');
        delete this.connections[socket.id];
      });
      socket.on('message', (type, data) => this.onMessage(socket, type, data));

      this.connections[socket.id] = new Connection(socket);
      console.log('Client', socket.request.connection.remoteAddress, 'connected.');
    });
  }

  /**
   * Construct a message and run middleware.
   * @param {Socket} socket
   * @param {String} type
   * @param {Object} data
   */
  async onMessage(socket, type, data = {}) {
    const req = new Message({ socket, connection: this.connections[socket.id], type, data });
    await this.handle(req, 0);
    return req;
  }

  /**
   * Run numbered middleware for a message.
   * @param {Message} req
   * @param {Number} index
   */
  async handle(req, index, err = null) {
    if (index >= this.handlers.length) {
      if (err) {
        throw err;
      }
      return;
    }
    if (this.handlers[index].filter(req) && (!err || this.handlers[index].isErrorHandler)) {
      await Promise.resolve(this.handlers[index].callback(req, async (err = null) => {
        if (err) {
          await this.handle(req, 0, err);
        } else {
          await this.handle(req, index + 1);
        }
      }, err));
    } else {
      await this.handle(req, index + 1, err);
    }
  }

  /**
   * Register a handler middleware.
   * @param {null|String|Function|RegExp} filter
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
   * Launch the socket server.
   */
  run() {
    console.log(`Listening on port ${this.config.PORT}.`);
    this.server.listen(this.config.PORT);
  }
}

module.exports = SocketServerCore;
