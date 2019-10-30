const jsonwebtoken = require('jsonwebtoken');
const SocketServerCore = require('./socket-server-core');

/**
 * Core server providing handling for login.
 */
class SocketServerAuth extends SocketServerCore {
  /**
   * @param {Object} config
   * @param {String} config.SECRET
   */
  constructor(config) {
    super(config);

    this.use('login', (req, next, err) => {
      if (err) {
        console.log('LOGIN ERR', err);
        return;
      }
      console.log('LOGIN HANDLER', req.type, req.data);
      const token = jsonwebtoken.sign({app: 'Stakes'}, this.config.SECRET);
      req.socket.emit('welcome', {user: {name: 'Sample User'}, token})
      // TODO: Handle authentication check and error returning via next().
      next('Login failed');
    });
  }
}

module.exports = SocketServerAuth;
