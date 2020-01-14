/**
 * A middleware function container.
 */
class Middleware {
  constructor(callback, filter = null) {
    if (typeof filter === 'string') {
      this.filter = (req) => req.type === filter;
    } else if (filter === null) {
      this.filter = (req) => true;
    } else if (filter instanceof RegExp) {
      this.filter = (req) => filter.test(req.type);
    } else if (typeof filter === 'function') {
      this.filter = (req) => filter(req);
    } else {
      throw new Error(`Socket middleware filter type ${typeof filter} not supported.`);
    }
    this.callback = callback;
    this.isErrorHandler = (callback.length > 2);
  }

  /**
   * Check if this middleware can handle the message.
   * @param {Message} req
   */
  canHandle(req) {
    if (!this.filter(req)) {
      return false;
    }
    if (req.error && !this.isErrorHandler) {
      return false;
    }
    return true;
  }

  /**
   * Execute this middleware.
   * @param {Message} req
   * @param {Function} next
   * @param {null|Error} err
   */
  async run(req, next, err = null) {
    try {
      return Promise.resolve(this.callback(req, next, err));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = Middleware;
