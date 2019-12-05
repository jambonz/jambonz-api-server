const test = require('tape').test ;
const exec = require('child_process').exec ;

test('starting docker network..', (t) => {
  exec(`docker-compose -f ${__dirname}/docker-compose-testbed.yaml up -d`, (err, stdout, stderr) => {
    if (err) t.end(err);

    console.log('docker network started, giving extra time to create test mysql database...');
    testMysql(60000, (err) => {
      if (err) {
        exec(`docker logs test_mysql_1`, (err, stdout, stderr) => {
          console.log(stdout);
          console.log(stderr);
        });
      }
      else t.pass('successfully connected to mysql');
      setTimeout(() => t.end(), 2000);
    });
  });
});

test('creating schema', (t) => {
  exec('docker exec test_mysql_1 mysql -h localhost -u jambones -D jambones -pjambones -e "source /tmp/jambones-sql.sql"', (err, stdout, stderr) => {
    if (!err) t.pass('successfully created schema');
    else {
      console.log(stderr);
      console.log(stdout);  
    }
    t.end(err);
  });
});

test('creating initial auth token', (t) => {
  exec('docker exec test_mysql_1 mysql -h localhost -u jambones -D jambones -pjambones -e "source /tmp/create-admin-token.sql"', (err, stdout, stderr) => {
    if (!err) t.pass('successfully created auth token');
    else {
      console.log(stderr);
      console.log(stdout);  
    }
    t.end(err);
  });
});

function testMysql(timeout, callback) {
  const retryTimer = setInterval(() => {
    exec('docker exec test_mysql_1 mysql -h localhost -u jambones -D jambones -pjambones -e "SELECT 1"', (err, stdout, stderr) => {
      if (!err) {
        clearTimeout(timeoutTimer);
        clearInterval(retryTimer);
        return callback(null);
      }
      //console.log(`failed connecting (err): ${stderr}`);
      //console.log(`failed connecting (out): ${stdout}`);
    });
  }, 4000);

  const timeoutTimer = setTimeout(() => {
    clearInterval(retryTimer);
    callback('timeout connecting to mysql');
  }, timeout);
}

