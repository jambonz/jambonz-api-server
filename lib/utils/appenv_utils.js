const Ajv = require('ajv');
const assert = require('assert');

const ajv = new Ajv();
const schemaSchema = require('./appenv_schemaSchema.json');


const validateAppEnvSchema = (schema) => {
  const validate = ajv.compile(schemaSchema);
  return validate(schema);
};

//Currently this request is not signed with the webhook secret as it is outside an account
const fetchAppEnvSchema = async(logger, url) => {
  // Translate WebSocket URLs to HTTP equivalents (case-insensitive)
  let fetchUrl = url;
  if (url.toLowerCase().startsWith('ws://')) {
    fetchUrl = 'http://' + url.substring(5);
  } else if (url.toLowerCase().startsWith('wss://')) {
    fetchUrl = 'https://' + url.substring(6);
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'OPTIONS',
      headers: {
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      logger.info(`Failure to fetch app env schema ${response.status} ${response.statusText}`);
      return false;
    }
    const schema = await response.json();
    return schema;
  }
  catch (e) {
    logger.info(`Failure to fetch app env schema ${e}`);
    return false;
  }
};

const validateAppEnvData = async(schema, data) => {
  const schemaKeys = Object.keys(schema);
  const dataKeys = Object.keys(data);
  let errorMsg = false;
  // Check for required keys
  schemaKeys.forEach((k) => {
    if (schema[k].required) {
      if (!dataKeys.includes(k)) {
        errorMsg = `Missing required value env_vars.${k}`;
        console.log(errorMsg);
      }
    }
  });
  //Validate the values
  dataKeys.forEach((k) => {
    if (schemaKeys.includes(k)) {
      try {
        // Check value is correct type
        assert(typeof data[k] == schema[k].type);
        // if enum check value is valid
        if (schema[k].enum) {
          assert(schema[k].enum.includes(data[k]));
        }
      } catch (error) {
        errorMsg = `Invalid value/type for env_vars.${k}`;
      }
    }
  });
  return errorMsg;
};

module.exports = {
  validateAppEnvSchema,
  fetchAppEnvSchema,
  validateAppEnvData
};
