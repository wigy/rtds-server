const jwt = require('jsonwebtoken');
const SocketServerCore = require('./SocketServerCore');

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
    this.skipAuthentication = new Set();

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

    // Handle logout messages and unsubscribe everything and delete client.
    this.use('logout', async (req, next, err) => {
      if (err) {
        this.log('error', `Logout failed for ${JSON.stringify(req.data)}`);
        return;
      }
      req.socket.emit('logout-successful');
    });

    // Everything else, check the token or deny access with 403 error.
    this.use((req, next) => {
      const error = (message) => {
        if (this.skipAuthentication.has(req.type)) {
          next();
          return;
        }
        req.socket.emit('failure', {status: 403, message});
      };

      if (!req.data.token) {
        error('No token provided.');
        return;
      }
      try {
        const decoded = jwt.verify(req.data.token, this.config.SECRET);
        if (decoded.app !== 'Stakes') {
          error('Token content invalid.');
          return;
        }
        req.user = decoded.user;
        next();
      } catch (err) {
        error('Token verification failed.');
      }
    });
  }

  /**
   * Allow a message type without authentication.
   * @param {String} type
   */
  noAuth(type) {
    this.skipAuthentication.add(type);
  }
}

module.exports = SocketServerAuth;
