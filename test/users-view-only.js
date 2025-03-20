const test = require('tape') ;
const jwt = require('jsonwebtoken');
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const exec = require('child_process').exec ;
const {generateHashedPassword} = require('../lib/utils/password-utils');
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

test('view-only user tests', async(t) => {
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
        name: 'sp1',
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider');
    const sp_sid = result.body.sid;
    /* add service_provider read only user */
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
        is_view_only: true
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'service_provider scope view-only user created');
    
    // login as service_provider read only user
    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: 'service_provider',
        password: password,  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as service provider view-only user');
    const spToken = {bearer: result.body.token};
    const spDecodedJwt = jwt.verify(result.body.token, process.env.JWT_SECRET);
    try {
      result = await request.post('/Accounts', {
        resolveWithFullResponse: true,
        auth: spToken,
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
      })
    } catch(err) {
      t.ok(err.statusCode === 403, 'As a view-only user, you cannot create an account');
    }
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
    })
    t.ok(result.statusCode === 201, 'successfully created account using admin token');
    const account_sid = result.body.sid;
    /* add account scope view-only user */
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
        account_sid: account_sid,
        is_view_only: true
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'account scope user created');
    const account_user_sid = result.body.user_sid;
    // login as account read only user
    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: 'account',
        password: password,  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as account view-only user');
    let userToken = {bearer: result.body.token};
    /* add an application which should fail as the logged in user is a view-only user */
    try {
      result = await request.post('/Applications', {
        resolveWithFullResponse: true,
        auth: userToken,
        json: true,
        body: {
          name: 'daveh',
          account_sid,
          call_hook: {
            url: 'http://example.com'
          },
          call_status_hook: {
            url: 'http://example.com/status',
            method: 'POST'
          },
          messaging_hook: {
            url: 'http://example.com/sms'
          },
          app_json : '[\
              {\
                "verb": "play",\
                "url": "https://example.com/example.mp3",\
                "timeoutSecs": 10,\
                "seekOffset": 8000,\
                "actionHook": "/play/action"\
            }\
          ]',
          use_for_fallback_speech: 1,
          fallback_speech_synthesis_vendor: 'google',
          fallback_speech_synthesis_language: 'en-US',
          fallback_speech_synthesis_voice: 'man',
          fallback_speech_synthesis_label: 'label1',
          fallback_speech_recognizer_vendor: 'google',
          fallback_speech_recognizer_language: 'en-US',
          fallback_speech_recognizer_label: 'label1'
        }
      });
    } catch(err) {
      t.ok(err.statusCode === 403, 'As a view-only user, you cannot create an application');
    }
    // change user as read/write user and create an application - it should succeed
    result = await request.put(`/Users/${account_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        is_view_only: false
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated user to read/write permissions');
    // login as account read only user
    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: 'account',
        password: password,  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as account read-write user');
    userToken = {bearer: result.body.token};
    /* add an application which should succeed as the logged in user is a read-write user */
    result = await request.post('/Applications', {
      resolveWithFullResponse: true,
      auth: userToken,
      json: true,
      body: {
        name: 'daveh',
        account_sid,
        call_hook: {
          url: 'http://example.com'
        },
        call_status_hook: {
          url: 'http://example.com/status',
          method: 'POST'
        },
        messaging_hook: {
          url: 'http://example.com/sms'
        },
        app_json : '[\
            {\
              "verb": "play",\
              "url": "https://example.com/example.mp3",\
              "timeoutSecs": 10,\
              "seekOffset": 8000,\
              "actionHook": "/play/action"\
          }\
        ]',
        use_for_fallback_speech: 1,
        fallback_speech_synthesis_vendor: 'google',
        fallback_speech_synthesis_language: 'en-US',
        fallback_speech_synthesis_voice: 'man',
        fallback_speech_synthesis_label: 'label1',
        fallback_speech_recognizer_vendor: 'google',
        fallback_speech_recognizer_language: 'en-US',
        fallback_speech_recognizer_label: 'label1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created an application');
    // change user back to view-only and query the application - it should succeed
    result = await request.put(`/Users/${account_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        is_view_only: true
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated user permission to view-only');
    // login as account read only user
    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: 'account',
        password: password,  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as account view-only user');
    userToken = {bearer: result.body.token};
    result = await request.get('/Applications', {
      auth: userToken,
      json: true,
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.length === 1 , 'successfully queried all applications with view-only user');
  } catch (err) {
      console.error(err);
      t.end(err);
    }
});