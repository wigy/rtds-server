const { PK } = require('rtds-query');
const SocketServerSync = require('./SocketServerSync');
const LiveQueryChannel = require('./LiveQueryChannel');

// If set, display logic of syncing.
const DEBUG_SYNCING = false;

class SocketServerLive extends SocketServerSync {

  constructor(config, {
    auth = async (_cred) => false,
    log = (type, ...msg) => console.log(`[${type}]`, ...msg),
    driver
  } = {}) {
    super(config, { auth, log });
    // A mapping form table names to set of subscriptions having dependency to the table.
    this.dependencies = {};
    if (!driver) {
      throw new Error('Live query server requires driver.');
    }
    this.driver = driver;
  }

  addChannel(channel, channelInstance) {
    if (this.channels[channel]) {
      throw new Error(`Channel ${channel} already defined.`);
    }
    this.channels[channel] = channelInstance;
  }

  /**
   * Create new channel from CRUD queries.
   * @param {String} channelName
   * @param {Object} queryRead
   * @param {Object} [queryCreate]
   * @param {Object} [queryUpdate]
   * @param {Object} [queryDelete]
   */
  makeChannel(channelName, queryRead, queryCreate = null, queryUpdate = null, queryDelete = null) {
    const channel = new LiveQueryChannel(this.driver, channelName, { queryCreate, queryRead, queryUpdate, queryDelete });
    this.addChannel(channelName, channel);
  }

  /**
   * Read the subscription data again and emit back to the connection.
   * @param {Subscription} sub
   */
  async refresh(sub) {
    const data = await sub.channel.read(sub.filter, {
      connection: sub.connection,
      server: this
    });
    sub.connection.socket.emit(sub.channel.name, data);
  }

  /**
   * Log synchronization debug messages.
   * @param  {any[]} args
   */
  logSync(...args) {
    if (DEBUG_SYNCING) {
      this.log('debug', '\u001b[33m{Sync}\u001b[0m', ...args);
    }
  }

  /**
   * Create new dependencies between tables and subscriptions.
   * @param {Subscription} sub
   * @param {Object<Set<Number>>>} pks
   */
  updateDependency(sub, pks) {
    Object.keys(pks).forEach(tableName => {
      this.dependencies[tableName] = this.dependencies[tableName] || new Set();
      this.dependencies[tableName].add(sub);
    });
  }

  /**
   * Nothing to do.
   * @param {Subscription} sub
   */
  addSubscription(sub) {
  }

  /**
   * Remove from all dependencies.
   * @param {Subscription} sub
   */
  dropSubscription(sub) {
    Object.keys(this.dependencies).forEach(tableName => {
      if (this.dependencies[tableName]) {
        this.dependencies[tableName].delete(sub);
      }
    });
  }

  /**
   * For future expansion: signal other server over Redis.
   * @param {String} table
   * @param {Any|Any[]} pk
   */
  async redisSync(table, pk) {
  }

  /**
   * Find all affected subscriptions and refresh them.
   * @param {Request} req
   * @param {Object[]} objects
   */
  async synchronize(req, objects) {
    // If set, scan through all subscriptions (for debugging purposes).
    const SAFE = false;
    for (const item of objects) {
      if (item === undefined) {
        continue;
      }

      const type = req.query.getType();
      const { channel, object } = item;
      const tableName = req.query.root.table;
      const pk = type === 'create' ? null : PK.getPK(req.query.root.pk, object);
      if (!tableName) {
        throw new Error(`Cannot figure out table name when synchronizing '${channel}'.`);
      }

      this.redisSync(tableName, pk);

      this.logSync(`Refreshing ${tableName} object with PK`, pk);
      const seenSubs = [];
      if (SAFE) {
        // Idiot proof implementation scanning all.
        for (const conn of Object.values(this.connections)) {
          this.logSync(`  Connection ${conn.id}`);
          for (const [channelName, subs] of Object.entries(conn.subscriptions)) {
            this.logSync(`    Channel ${channelName} subscriptions per filter`);
            for (const sub of subs) {
              if (sub.hasSeen(tableName, pk)) {
                seenSubs.push(sub);
                this.logSync(`      [X] ${sub.filter}`);
              } else {
                this.logSync(`      [ ] ${sub.filter}`);
              }
            }
          }
        }
      } else {
        // Smart implementation exploiting dependency book-keeping.
        if (this.dependencies[tableName]) {
          this.logSync(`  Found ${this.dependencies[tableName].size} dependencies`);
          for (const sub of this.dependencies[tableName]) {
            if (sub.hasSeen(tableName, pk)) {
              seenSubs.push(sub);
              this.logSync(`      [X] ${sub.connection.id} ${sub.channel.name} ${sub.filter}`);
            } else {
              this.logSync(`      [ ] ${sub.connection.id} ${sub.channel.name} ${sub.filter}`);
            }
          }
        } else {
          this.logSync('  Found no dependencies');
        }
      }

      for (const sub of seenSubs) {
        await this.refresh(sub);
      }
    }
  }
}

module.exports = SocketServerLive;
