const jwt = require('jsonwebtoken');
const SocketServerCore = require('./socket-server-core');

/**
 * Core server providing handling for login.
 */
class SocketServerAuth extends SocketServerCore {
  /**
   * Provide configuration and user verification function returning user data on success.
   * @param {Object} config
   * @param {String} config.SECRET
   * @param {Number} config.PORT
   * @param {Object} hooks
   * @param {Function} hooks.log
   * @param {Function} hooks.auth
   */
  constructor(config, {
    auth = async (_cred) => false,
    log = (type, ...msg) => console.log(`[${type}]`, ...msg)
  } = {}) {
    super(config, { log });

    // Handle login messages and send signed token on success or 401 error on failure.
    this.use('login', async (req, next, err) => {
      if (err) {
        this.log('error', `Login failed for ${JSON.stringify(req.data)}`);
        return;
      }
      const user = await Promise.resolve(auth(req.data));
      if (!user) {
        req.socket.emit('login-failed', {status: 401, message: 'Login failed.'});
        return next(new Error('Login failed'));
      }
      const token = jwt.sign({app: 'Stakes', user}, this.config.SECRET);
      req.socket.emit('login-successful', {user, token});
    });

    // Everything else, check the token or deny access with 403 error.
    this.use((req, next) => {
      if (!req.data.token) {
        req.socket.emit('failure', {status: 403, message: 'No token provided.'});
        return;
      }
      try {
        const decoded = jwt.verify(req.data.token, this.config.SECRET);
        if (decoded.app !== 'Stakes') {
          req.socket.emit('failure', {status: 403, message: 'Token content invalid.'});
          return;
        }
        req.user = decoded.user;
        next();
      } catch (err) {
        req.socket.emit('failure', {status: 403, message: 'Token verification failed.'});
      }
    });
  }
}

module.exports = SocketServerAuth;
