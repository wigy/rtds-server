CREATE TABLE investors (
  id integer not null primary key,
  name varchar(16) not null,
  email varchar(64) not null,
  tag varchar(8) not null
);

INSERT INTO investors (id, name, email, tag) VALUES (1, 'Company A', 'a@email.com', 'A'), (2, 'Company B', 'b@email.com', 'B'), (3, 'Company C', 'c@email.com', 'C');
