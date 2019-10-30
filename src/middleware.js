/**
 * A middleware function container.
 */
class Middleware {
  constructor(callback, filter = null) {
    // TODO: Support for regex and test function.
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
}

module.exports = Middleware;
