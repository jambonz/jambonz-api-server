const test = require('tape') ;
const exec = require('child_process').exec ;

test('creating jambones_test database', (t) => {
  exec(`mysql -h 127.0.0.1 -u root --protocol=tcp --port=3360 < ${__dirname}/../db/create_test_db.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('database successfully created');
    t.end();
  });
});

test('creating schema', (t) => {
  exec(`mysql -h 127.0.0.1 -u root --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/jambones-sql.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('schema successfully created');
    t.end();
  });
});

test('creating auth token', (t) => {
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/create-admin-token.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('auth token successfully created');
    t.end();
  });
});

test('add predefined carriers', (t) => {
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/add-predefined-carriers.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('predefined carriers added');
    t.end();
  });
});

test('prepare permissions', (t) => {
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/prepare-permissions-test.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('permissions prepared');
    t.end();
  });
});
