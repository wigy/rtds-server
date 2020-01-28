# Real-Time Data Sync - Server

A socket IO based server for providing live query support, i.e. client sends one query to
fetch data it needs and if the received objects are later updated, the query will be
automatically executed and results sent again. This is designed for use with
[RTDS Client](https://github.com/wigy/rtds-client). More details about query definitions
can be found from [RTDS Query](https://github.com/wigy/rtds-query).

## Usage

### Setting Up The Server

We assume that we have database set up done with other means like
[Knex](https://www.npmjs.com/package/knex) or
[Flyway](https://www.npmjs.com/package/flywaydb-cli). In the server code, we need to initialize
a driver for the database. For example
```
  const { Driver } = require('rtds-query');
  const driver = Driver.create(`sqlite:///${__dirname}/app-db.sqlite`);
  await driver.initialize();
```

A server instance can be created with
```
  const { SocketServerLive } = require('rtds-server');
  const server = new SocketServerLive({
      PORT: 2999,
      SECRET: 'xyz123'
    }, {
      driver,
      auth: ({user, password}) => checkUser({user, password})),
      log: (type, ...msg) => console.log(`[${type}]`, msg)
    });
```
The first argument is the configuration having `PORT` to tell which port the server will listen
to and `SECRET` is a signing key for authentication tokens. The second parameter has fields
`driver` to pass SQL driver to the server, `auth` which is a function to verify user credentials
and `log`, which is a hook for logging internal events in the server.

### Defining Channels

A channel is a concept for grouping together related data. It is recommended but not required
that the channel name is the same as the primary table name. One channel can return rows from
many tables, but creating, updating and deleting is only allowed for one table. For example, if
our application is a small Todo-list application, the `"todo"` channel can return the following
JSON-structure
```
[
  {
    "id": 101,
    "title": "Need to do something",
    "creator": {
      "id": 201
      "name": "Ali Baba"
    },
    "comments": [
      {"id": 301, "text": "Who needs this?", "user": {"id": 202, "name": "Bali Aba"}},
      {"id": 302, "text": "Me", "user": {"id": 201, "name": "Ali Baba"}}
    ]
  }
]
```
It has data from tables `todos` (id 101), `users` (id 201 and 202) and `comments` (id 301
and 302). A client, which received this data, will get automatically an update if
any of the mentioned objects are changed or deleted. In addition, it gets updates when
any of the mentioned tables get new rows. The query that produced the above data could be
something like
```
const readQuery = {
  "select": ["id", "title"],
  "table": "todos",
  "members": [
    {
      "select": ["id", "name"],
      "table": "users",
      "as": "creator",
      "join": ["users.id", "todos.creatorId"]
    }
  ],
  "collections": [
    {
      "table": "comments",
      "select": ["id", "text"],
      "leftJoin": ["comments.todoId", "todos.id"],
      "members": [
        {
          "select": ["id", "name"],
          "table": "users",
          "as": "user",
          "join": ["users.id", "comments.creatorId"]
        }
      ]
    }
  ]
}
```

In addition to reading data, we need queries for creating new todo-entries
```
const q2 = {
  "insert": ["title", "creatorId", "isDone"],
  "table": "todos"
}
```
for updating title or done-status for existing entries
```
const q3 = {
  "update": ["title", "isDone"],
  "table": "todos"
}
```
and deleting them by `id`
```
const q4 = {
  "delete": "id",
  "table": "todos"
}
```

From the queries above, the channel `"todo"` can be defined
```
  server.makeChannel('todo', q1, q2, q3, q4);
```
Here q1 is read, q2 is create, q3 is update and q4 is delete query defined earlier.

It is customary to use singular channel name for retrieving detailed data of a single item and
to manipulating data. Then use additional channel in plural form, e.g. `"todos"`, which is used
just to fetch less data from all entries. That channel has no queries defined for manipulation.
For example, in this case it could be defined as
```
  server.makeChannel('todos', {
    "select": ["id", "title", "isDone"]
    "table": "todos",
    "order": ["isDone", "id"]
  });
```
If the additional queries are not defined, then the creation, update and deletion is disabled
for that channel.

### Launching the server

Once the channels are defined, the server can be launched
```
  server.useDebug();
  server.use404();
  server.run();
```
Here we turn on debugging information, add handler to return error message if undefined channels
are accessed, and finally starting the server.

## Example

There is a simple example that can be used out of the box with the RTDS Client.
```
cd example
npm install
npm start
```
