const test = require('tape').test ;
const exec = require('child_process').exec ;
const pwd = process.env.CI ? '' : '-p$MYSQL_ROOT_PASSWORD';

test('dropping jambones_test database', (t) => {
  exec(`mysql -h 127.0.0.1 -u root ${pwd} --protocol=tcp < ${__dirname}/../db/remove_test_db.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('database successfully dropped');
    t.end();
    process.exit(0);
  });
});
