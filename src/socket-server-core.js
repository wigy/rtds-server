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
   * Launch the socket server.
   */
  run() {
    console.log(`Listening on port ${this.config.PORT}.`);
    this.server.listen(this.config.PORT);
  }
}

module.exports = SocketServerCore;
