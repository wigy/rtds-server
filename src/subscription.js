const Filter = require('./filter');

/**
 * A description of a channel subscription.
 *
 * A collection of primary keys read is maintained in `seen` field.
 * It is a mapping from table names to the sets of primary keys.
 */
class Subscription {
  /**
   * Establish subscription from connection to channel.
   * @param {Channel} channel
   * @param {Filter|Object} filter
   * @param {Connection} connection
   */
  constructor(channel, filter, connection) {
    if (!(filter instanceof Filter)) {
      filter = new Filter(filter);
    }
    this.channel = channel;
    this.filter = filter;
    this.connection = connection;
    this.seen = {};
  }

  /**
   * Record the primary keys from the latest read for this subscription.
   * @param {Object<Set<Number>>>} pks
   */
  updateLatestRead(pks) {
    Object.assign(this.seen, pks);
  }

  /**
   * Check if subscription has seen the given object in the given table.
   * @param {String} table
   * @param {null|Any|Any[]} pk Primary key(s) or null if just created.
   */
  hasSeen(table, pk) {
    if (this.seen[table] && pk === null) {
      return true;
    }
    return this.seen[table] && this.seen[table].has(pk);
  }
}

module.exports = Subscription;
