const Filter = require('./filter');

/**
 * A description of a channel subscription.
 */
class Subscription {
  constructor(channel, filter) {
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    this.channel = channel;
    this.filter = filter;
  }
}

module.exports = Subscription;
