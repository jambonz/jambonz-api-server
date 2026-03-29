const test = require('tape').test ;
const exec = require('child_process').exec ;

test('dropping jambones_test database', (t) => {
  exec(`docker exec -i mysql-jambonz-test mysql -u root < ${__dirname}/../db/remove_test_db.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('database successfully dropped');
    t.end();
    process.exit(0);
  });
});
