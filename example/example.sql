CREATE TABLE todos (
  id integer not null primary key,
  title varchar(16) not null,
  done boolean not null default false
);

CREATE TABLE comments (
  id integer not null primary key,
  comment varchar(256) not null,
  todoId integer
);
