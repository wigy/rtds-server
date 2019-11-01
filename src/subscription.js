/**
 * A description of a channel subscription.
 */
class Subscription {
  constructor(channel, filter) {
    this.channel = channel;
    this.filter = filter;
  }

  isSame(other) {
    if (this.filter === null) {
      return other.filter === null;
    }
    if (other.filter === null) {
      return false;
    }
    return !Object.keys(this.filter).some((k) => this.filter[k] !== other.filter[k]);
  }
}

module.exports = Subscription;
