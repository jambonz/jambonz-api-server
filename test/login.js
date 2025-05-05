const test = require('tape') ;
const jwt = require('jsonwebtoken');
const { createClient } = require('./http-client');
const request = createClient({
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

test('login tests', async(t) => {
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

    const maxAttempts = process.env.LOGIN_ATTEMPTS_MAX_RETRIES || 6;
    const attempTime = process.env.LOGIN_ATTEMPTS_TIME || 1800;
    
    for (let index = 0; index <= maxAttempts; index++) {
        if (index === (maxAttempts - 1)) {

            attemptResult = await request.post('/login', {
              resolveWithFullResponse: true,
              json: true,
              body: {
                username: 'admin',
                password: 'adm',  
              }
            }).catch(error => {
              t.ok(error.statusCode === 403, `Maximum login attempts reached. Please try again in ${attempTime} seconds.`)
          });
        } else if (index < maxAttempts) {
          attemptResult = await request.post('/login', {
            resolveWithFullResponse: true,
            json: true,
            body: {
              username: 'admin',
              password: 'adm',  
            }
          }).catch(error => {
            console.log(JSON.stringify(error));
            t.ok(error.statusCode === 403);
          });
        } else {
            attemptResult = await request.post('/login', {
                resolveWithFullResponse: true,
                json: true,
                body: {
                  username: 'admin',
                  password: 'adm',  
                }
              }).catch(error => t.ok(error.statusCode === 403, 'Maximum login attempts reached. Please try again later or reset your password.'));
        }
    }

  } catch (err) {
      console.error(err);
      t.end(err);
    }
  });
  
  