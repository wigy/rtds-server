const { SocketServerLive } = require('rtds-server');
const { Driver } = require('rtds-query');
const fs = require('fs');

async function main() {
  // Delete old database and initialize new from the 'example.sql'.
  const path = `${__dirname}/example.sqlite`;
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
  const driver = Driver.create(`sqlite:///${path}`);
  await driver.runSqlFile(`${__dirname}/example.sql`);
  await driver.initialize();

  // Set up the live server and define channels.
  const server = new SocketServerLive({ PORT: 2999, SECRET: 'xyz123' }, { driver, auth: () => ({id: 1, name: 'auto'}) });
  server.makeChannel('todos', {
    select: ['id', 'title', 'done'],
    table: 'todos'
  }, {
    insert: ['title'],
    table: 'todos'
  }, {
    update: ['title'],
    table: 'todos'
  }, {
    delete: ['id'],
    table: 'todos'
  });

  // Turn on debugging, error handling and launch the server.
  server.useDebug();
  server.use404();
  server.run();
}

main().catch(err => console.error(err));
