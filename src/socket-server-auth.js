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
   * @param {Function} verify
   * @param {Function} error
   */
  constructor(config, verify, error = (err) => console.error(err)) {
    super(config);

    // Handle login messages and send signed token on success or 401 error on failure.
    this.use('login', async (req, next, err) => {
      if (err) {
        error(`Login failed for ${JSON.stringify(req.data)}`);
        return;
      }
      const user = await Promise.resolve(verify(req.data));
      if (!user) {
        req.socket.emit('failure', {status: 401, message: 'Login failed.'});
        return next(new Error('Login failed'));
      }
      const token = jwt.sign({app: 'Stakes', user}, this.config.SECRET);
      req.socket.emit('welcome', {user, token})
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
      } catch(err) {
        req.socket.emit('failure', {status: 403, message: 'Token verification failed.'});
      }
    });
  }
}

module.exports = SocketServerAuth;
