const test = require('tape');
const jwt = require('jsonwebtoken');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, createAccount, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('llm credentials tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const service_provider_sid = await createServiceProvider(request);
    const account_sid = await createAccount(request, service_provider_sid);

    /* return 400 if invalid sid param is used */
    try {
      result = await request.post(`/ServiceProviders/foobarbaz/LlmCredentials`, {
        resolveWithFullResponse: true,
        simple: false,
        auth: authAdmin,
        json: true,
        body: {
          vendor: 'openai',
          api_key: 'test-api-key'
        }
      });
    } catch (err) {
      t.ok(err.statusCode === 400, 'returns 400 bad request if service provider sid param is not a valid uuid');
    }

    /* add a llm credential to a service provider */
    result = await request.post(`/ServiceProviders/${service_provider_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        vendor: 'openai',
        api_key: 'test-api-key'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added a llm credential to service provider');
    const llm_credential_sid = result.body.sid;

    /* query llm credentials for a service provider */
    result = await request.get(`/ServiceProviders/${service_provider_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
    });
    t.ok(result.statusCode === 200, 'successfully queried llm credential from service provider');

    await deleteObjectBySid(request, `/ServiceProviders/${service_provider_sid}/LlmCredentials`, llm_credential_sid);

    const token = jwt.sign({
      account_sid,
      service_provider_sid,
      scope: 'account',
      permissions: ["PROVISION_USERS", "PROVISION_SERVICES", "VIEW_ONLY"]
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const authUser = {bearer: token};

    /* add a credential  */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        label: 'label1',
        api_key: 'test-api-key'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added llm credential');
    const sid1 = result.body.sid;

    /* return 403 if invalid account is used - randomSid: bed7ae17-f8b4-4b74-9e5b-4f6318aae9c9 */
    result = await request.post(`/Accounts/bed7ae17-f8b4-4b74-9e5b-4f6318aae9c9/LlmCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        api_key: 'test-api-key'
      }
    });
    t.ok(result.statusCode === 403, 'returns 403 Forbidden if Account does not match jwt');
    
    /* query one credential */
    result = await request.get(`/Accounts/${account_sid}/LlmCredentials/${sid1}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.vendor === 'openai' , 'successfully retrieved llm credential by sid');
    t.ok(result.label === 'label1' , 'label is successfully created');
    
    /* query all credentials */
    result = await request.get(`/Accounts/${account_sid}/LlmCredentials`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result[0].vendor === 'openai' && result.length === 1, 'successfully retrieved all llm credentials');
    
    /* return 400 when deleting credentials with invalid uuid */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/foobarbaz`, {
      auth: authUser,
      resolveWithFullResponse: true,
      simple: false
    });
    t.ok(result.statusCode === 400, 'return 400 when attempting to delete credential with invalid uuid');

    /* return 404 when deleting unknown credentials */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/`, {
      auth: authUser,
      resolveWithFullResponse: true,
      simple: false
    });
    t.ok(result.statusCode === 404, 'return 404 when attempting to delete unknown credential');

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${sid1}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted llm credential');

    /* add / test a credential for openai */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        api_key: 'test-api-key'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added llm credential for openai');
    const openai_sid = result.body.sid;

    /* test the llm credential */
    result = await request.get(`/Accounts/${account_sid}/LlmCredentials/${openai_sid}/test`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,   
    });
    t.ok(result.statusCode === 200, 'successfully tested llm credential for openai');

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${openai_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted llm credential');

    /* add a credential for anthropic */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'anthropic',
        api_key: 'test-anthropic-key'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added llm credential for anthropic');
    const anthropic_sid = result.body.sid;

    /* test the llm credential */
    result = await request.get(`/Accounts/${account_sid}/LlmCredentials/${anthropic_sid}/test`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,   
    });
    t.ok(result.statusCode === 200, 'successfully tested llm credential for anthropic');

    /* delete the credential */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${anthropic_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted llm credential');

    /* test updating a credential */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        label: 'test-update',
        api_key: 'original-key'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added llm credential for update test');
    const update_sid = result.body.sid;

    /* delete the updated credential */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${update_sid}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted updated llm credential');

    /* test duplicate label validation */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        label: 'duplicate-test',
        api_key: 'test-key-1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added first llm credential with label');
    const duplicate_sid1 = result.body.sid;

    /* try to add another credential with same label */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        label: 'duplicate-test',
        api_key: 'test-key-2'
      }
    });
    t.ok(result.statusCode === 422, 'returns 422 when trying to add duplicate label');

    /* delete the first credential */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${duplicate_sid1}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted first duplicate label credential');

    /* test credentials without labels (should be allowed) */
    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'openai',
        api_key: 'test-key-no-label-1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added llm credential without label');
    const no_label_sid1 = result.body.sid;

    result = await request.post(`/Accounts/${account_sid}/LlmCredentials`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        vendor: 'anthropic',
        api_key: 'test-key-no-label-2'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added another llm credential without label');
    const no_label_sid2 = result.body.sid;

    /* clean up credentials without labels */
    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${no_label_sid1}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted first credential without label');

    result = await request.delete(`/Accounts/${account_sid}/LlmCredentials/${no_label_sid2}`, {
      auth: authUser,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted second credential without label');

    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});
