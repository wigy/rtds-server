const { Query } = require('rtds-query');
const Channel = require('./Channel');

class LiveQueryChannel extends Channel {
  constructor(driver, channelName, { queryCreate, queryRead, queryUpdate, queryDelete }) {
    const callbacks = {};

    if (queryCreate) {
      queryCreate = new Query(queryCreate);
      callbacks.create = async (data, req) => {
        req.query = queryCreate;
        return queryCreate.create(driver, data);
      };
    }

    if (queryRead) {
      queryRead = new Query(queryRead);
      callbacks.read = async (filter, req) => {
        req.query = queryRead;
        const pks = await queryRead.selectPKs().allPKs(driver, filter.expression);
        req.connection.updateLatestRead(this, filter, pks);
        req.server.logSync(`Client ${req.connection.id} has now seen`, pks, `on ${channelName}.`);
        return queryRead.select(driver, filter.expression);
      };
    }

    if (queryUpdate) {
      queryUpdate = new Query(queryUpdate);
      callbacks.update = async (data, req) => {
        req.query = queryUpdate;
        return queryUpdate.update(driver, data);
      };
    }

    if (queryDelete) {
      queryDelete = new Query(queryDelete);
      callbacks.del = async (data, req) => {
        req.query = queryDelete;
        await queryDelete.delete(driver, data);
        return data;
      };
    }

    super(channelName, callbacks);

    this.queryCreate = queryCreate;
    this.queryRead = queryRead;
    this.queryUpdate = queryUpdate;
    this.queryDelete = queryDelete;
  }
}

module.exports = LiveQueryChannel;
