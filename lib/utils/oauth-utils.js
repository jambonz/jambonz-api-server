const assert = require('assert');
const {emailSimpleText} = require('./email-utils');
const {DbErrorForbidden} = require('../utils/errors');

const doGithubAuth = async(logger, payload) => {
  assert.ok(process.env.GITHUB_CLIENT_SECRET, 'env var GITHUB_CLIENT_SECRET is required');

  try {
    /* exchange the code for an access token */
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: payload.oauth2_client_id,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: payload.oauth2_code,
        state: payload.oauth2_state,
        redirect_uri: payload.oauth2_redirect_uri
      })
    });
    if (!response.ok) {
      logger.error({response}, 'Error retrieving access_token from github');
      throw new DbErrorForbidden(await response.text());
    }

    const obj = await response.json();
    if (!obj.access_token) {
      logger.error({obj}, 'Error retrieving access_token from github');
      if (obj.error === 'bad_verification_code') throw new Error('bad verification code');
      throw new Error(obj.error || 'error retrieving access_token');
    }
    logger.debug({obj}, 'got response from github for access_token');

    /* use the access token to get basic public info as well as primary email */
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${obj.access_token}`,
        Accept: 'application/json',
        'User-Agent': 'jambonz 1.0'
      }
    });
    if (!userResponse.ok) {
      logger.error({userResponse}, 'Error retrieving user details from github');
      throw new DbErrorForbidden(await userResponse.text());
    }
    const userDetails = await userResponse.json();

    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${obj.access_token}`,
        Accept: 'application/json',
        'User-Agent': 'jambonz 1.0'
      }
    });
    if (!emailsResponse.ok) {
      logger.error({emailsResponse}, 'Error retrieving emails from github');
      throw new DbErrorForbidden(await emailsResponse.text());
    }
    const emails = await emailsResponse.json();
    const primary = emails.find((e) => e.primary);
    if (primary) Object.assign(userDetails, {
      email: primary.email,
      email_validated: primary.validated
    });

    logger.info({userDetails}, 'retrieved user details from github');
    return userDetails;
  } catch (err) {
    logger.info({err}, 'Error authenticating via github');
    throw new DbErrorForbidden(err.message);
  }
};

const doGoogleAuth = async(logger, payload) => {
  assert.ok(process.env.GOOGLE_OAUTH_CLIENT_SECRET, 'env var GOOGLE_OAUTH_CLIENT_SECRET is required');

  try {
    /* exchange the code for an access token */
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: payload.oauth2_client_id,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        code: payload.oauth2_code,
        state: payload.oauth2_state,
        redirect_uri: payload.oauth2_redirect_uri,
        grant_type: 'authorization_code'
      })
    });
    if (!response.ok) {
      logger.error({response}, 'Error retrieving access_token from google');
      throw new DbErrorForbidden(await response.text());
    }
    const obj = await response.json();
    if (!obj.access_token) {
      logger.error({obj}, 'Error retrieving access_token from github');
      if (obj.error === 'bad_verification_code') throw new Error('bad verification code');
      throw new Error(obj.error || 'error retrieving access_token');
    }
    logger.debug({obj}, 'got response from google for access_token');

    /* use the access token to get basic public info as well as primary email */
    const userDetailsResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${obj.access_token}`,
        Accept: 'application/json',
        'User-Agent': 'jambonz 1.0'
      }
    });
    if (!userDetailsResponse.ok) {
      logger.error({userDetailsResponse}, 'Error retrieving user details from google');
      throw new DbErrorForbidden(await userDetailsResponse.text());
    }
    const userDetails = await userDetailsResponse.json();
    logger.info({userDetails}, 'retrieved user details from google');
    return userDetails;
  } catch (err) {
    logger.info({err}, 'Error authenticating via google');
    throw new DbErrorForbidden(err.message);
  }
};
const doLocalAuth = async(logger, payload) => {
  const {name, email, password, email_activation_code} = payload;
  const text = `Hi there

  Welcome to jambonz!  Your account activation code is ${email_activation_code}
  
  Best,
  
  The jambonz team`;

  if ('test' !== process.env.NODE_ENV || process.env.MAILGUN_API_KEY) {
    await emailSimpleText(logger, email, 'Account activation code', text);
  }
  return {
    name,
    email,
    password,
    email_activation_code
  };
};

module.exports = {
  doGithubAuth,
  doGoogleAuth,
  doLocalAuth
};
