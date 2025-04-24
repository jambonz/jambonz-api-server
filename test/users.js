const test = require('tape') ;
const jwt = require('jsonwebtoken');
const { createClient } = require('./http-client');
const request = createClient({
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
test('prepare permissions', (t) => {
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/prepare-permissions-test.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('permissions prepared');
    t.end();
  });
});
test('user tests', async(t) => {
  const app = require('../app');
  const password = 'abcde12345-';
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
    const authAdmin = {bearer: result.body.token};
    const decodedJwt = jwt.verify(result.body.token, process.env.JWT_SECRET);

    /* add admin user */
    result = await request.post(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        name: 'admin2',
        email: 'admin2@jambonz.com',
        is_active: true,
        force_change: true,
        initial_password: password,
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'admin user created');
    const admin_user_sid = result.body.user_sid;

    /* add a service provider */
    result = await request.post('/ServiceProviders', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'sp',
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider');
    const sp_sid = result.body.sid;

    /* add service_provider user */
    result = await request.post(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        name: 'service_provider',
        email: 'sp@jambonz.com',
        is_active: true,
        force_change: true,
        initial_password: password,
        service_provider_sid: sp_sid,
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'service_provider scope user created');
    const sp_user_sid = result.body.user_sid;

    /* add an account */
    result = await request.post('/Accounts', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'sample_account',
        service_provider_sid: sp_sid,
        registration_hook: {
          url: 'http://example.com/reg',
          method: 'get'
        },
        webhook_secret: 'foobar'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account');
    const account_sid = result.body.sid;

    /* add account user */
    result = await request.post(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        name: 'account',
        email: 'account@jambonz.com',
        is_active: true,
        force_change: true,
        initial_password: password,
        service_provider_sid: sp_sid,
        account_sid: account_sid
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'account scope user created');
    const account_user_sid = result.body.user_sid;

    /* retrieve list of users */
    result = await request.get(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 200 && result.body.length, 'successfully user list');
  
    /* delete account user */
    result = await request.delete(`/Users/${account_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 204, 'account scope user deleted');

    /* delete sp user */
    result = await request.delete(`/Users/${sp_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 204, 'account scope user deleted');

    /* delete admin user */
    result = await request.delete(`/Users/${admin_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 204, 'account scope user deleted');

    // /* self delete as admin user */
    // result = await request.delete(`/Users/${decodedJwt.user_sid}`, {
    //   resolveWithFullResponse: true,
    //   json: true,
    //   auth: authAdmin,
    // });
    // t.ok(result.statusCode === 500 && result.error.msg === 'cannot delete this admin user - there are no other active admin users');

    /* add another service_provider user */
    result = await request.post(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        name: 'service_provider1',
        email: 'sp1@jambonz.com',
        is_active: true,
        force_change: false,
        initial_password: password,
        service_provider_sid: sp_sid,
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'service_provider scope user created');

    /* logout as sp to get a jwt */
    result = await request.post('/logout', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.statusCode === 204, 'successfully logged out');

    // /* login as sp user to get a jwt */
    // result = await request.post('/login', {
    //   resolveWithFullResponse: true,
    //   json: true,
    //   body: {
    //     username: 'service_provider1',
    //     password: 'abcd1234-',  
    //   }
    // });
    // t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as sp');
    // const authSPUser = {bearer: result.body.token};

    // result = await request.post(`/Users`, {
    //   resolveWithFullResponse: true,
    //   json: true,
    //   auth: authSPUser,
    //   body: {
    //     name: 'sp2',
    //     email: 'sp2@jambonz.com',
    //     is_active: true,
    //     force_change: false,
    //     initial_password: password,
    //   }
    // });
    // t.ok(result.statusCode === 403, 'sp user cannot create admin users');

  } catch (err) {
      console.error(err);
      t.end(err);
    }
  });
  
  