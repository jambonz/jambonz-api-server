const test = require('tape') ;
const { createClient } = require('./http-client');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('password settings tests', async(t) => {

  /* Check Default Password Settings */
  result = await request.get('/PasswordSettings', {
    auth: authAdmin,
    json: true,
  });
  t.ok(result.min_password_length == 8 && 
    !result.require_digit &&
    !result.require_special_character, "default password settings is correct!")

  /* Post New Password settings*/

  result = await request.post('/PasswordSettings', {
    auth: authAdmin,
    json: true,
    resolveWithFullResponse: true,
    body: {
      min_password_length: 15,
      require_digit: 1,
      require_special_character: 1
    }
  });

  t.ok(result.statusCode === 201, 'successfully added a password settings');

  /* Check Password Settings*/
  result = await request.get('/PasswordSettings', {
    auth: authAdmin,
    json: true,
  });

  t.ok(result.min_password_length === 15 && 
    result.require_digit === 1 &&
    result.require_special_character === 1, 'successfully queried password settings');

  /* Update Password settings*/
  result = await request.post('/PasswordSettings', {
    auth: authAdmin,
    json: true,
    resolveWithFullResponse: true,
    body: {
      min_password_length: 10,
      require_special_character: 0
    }
  });

  t.ok(result.statusCode === 201, 'successfully updated a password settings');

  /* Check Password Settings After update*/
  result = await request.get('/PasswordSettings', {
    auth: authAdmin,
    json: true,
  });

  t.ok(result.min_password_length === 10 && 
    result.require_digit === 1 &&
    result.require_special_character === 0, 'successfully queried password settings after updated');
});