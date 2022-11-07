const test = require('tape') ;
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const exec = require('child_process').exec ;


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('add an admin user', (t) => {
  exec(`${__dirname}/../db/reset_admin_password.js`, (err, stdout, stderr) => {
    console.log(stderr);
    console.log(stdout);
    if (err) return t.end(err);
    t.pass('successfully added admin user');
    t.end();
  });
});

test('user tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* login as admin to get a jwt */
    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: 'admin',
        password: 'admin',  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as admin');

    /* retrieve list of users */
    const authAdmin = {bearer: result.body.token};
    result = await request.get(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200 && result.body.length === 1, 'successfully user list');
  } catch (err) {
      console.error(err);
      t.end(err);
    }
  });
  
  