const test = require('tape');
const exec = require('child_process').exec ;

const waitForMySQL = (attempts = 0, maxAttempts = 30) => {
  return new Promise((resolve, reject) => {
    const check = () => {
      exec('docker exec mysql-jambonz-test mysqladmin ping -u root --silent', (err) => {
        if (!err) return resolve();
        if (++attempts >= maxAttempts) return reject(new Error('MySQL did not become ready in time'));
        setTimeout(check, 2000);
      });
    };
    check();
  });
};

test('starting docker network..', (t) => {
  t.plan(1);
  exec(`docker compose -f ${__dirname}/docker-compose-testbed.yaml up -d`, (err, stdout, stderr) => {
    if (err) return t.fail(err.message);
    waitForMySQL()
      .then(() => t.pass('docker started'))
      .catch((err) => t.fail(err.message));
  });
});
