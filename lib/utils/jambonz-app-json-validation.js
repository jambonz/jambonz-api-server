const {DbErrorBadRequest} = require('../utils/errors');
const assert = require('assert');
const _specData = require('./specs');
const specs = new Map();
for (const key in _specData) { specs.set(key, _specData[key]); }

function normalizeJambones(logger, obj) {
  if (!Array.isArray(obj)) throw new DbErrorBadRequest('malformed jambonz payload: must be array');
  const document = [];
  for (const tdata of obj) {
    if (typeof tdata !== 'object') throw new DbErrorBadRequest('malformed jambonz payload: must be array of objects');
    if ('verb' in tdata) {
      // {verb: 'say', text: 'foo..bar'..}
      const name = tdata.verb;
      const o = {};
      Object.keys(tdata)
        .filter((k) => k !== 'verb')
        .forEach((k) => o[k] = tdata[k]);
      const o2 = {};
      o2[name] = o;
      document.push(o2);
    }
    else if (Object.keys(tdata).length === 1) {
      // {'say': {..}}
      document.push(tdata);
    }
    else {
      logger.info(tdata, 'malformed jambonz payload: missing verb property');
      throw new DbErrorBadRequest('malformed jambonz payload: missing verb property');
    }
  }
  logger.debug({ document }, `normalizeJambones: returning document with ${document.length} tasks`);
  return document;
}

function validate(logger, obj) {
  normalizeJambones(logger, obj).map((tdata) => {
    const keys = Object.keys(tdata);
    const name = keys[0];
    const data = tdata[name];
    validateVerb(name, data, logger);
  });
}

function validateVerb(name, data, logger) {
  logger.debug(`validating ${name} with data ${JSON.stringify(data)}`);
  // validate the instruction is supported
  if (!specs.has(name)) throw new DbErrorBadRequest(`invalid instruction: ${name}`);

  // check type of each element and make sure required elements are present
  const specData = specs.get(name);
  let required = specData.required || [];
  for (const dKey in data) {
    if (dKey in specData.properties) {
      const dVal = data[dKey];
      const dSpec = specData.properties[dKey];
      logger.debug(`Task:validate validating property ${dKey} with value ${JSON.stringify(dVal)}`);

      if (typeof dSpec === 'string' && dSpec === 'array') {
        if (!Array.isArray(dVal)) throw new DbErrorBadRequest(`${name}: property ${dKey} is not an array`);
      }
      else if (typeof dSpec === 'string' && dSpec.includes('|')) {
        const types = dSpec.split('|').map((t) => t.trim());
        if (!types.includes(typeof dVal) && !(types.includes('array') && Array.isArray(dVal))) {
          throw new DbErrorBadRequest(`${name}: property ${dKey} has invalid data type, must be one of ${types}`);
        }
      }
      else if (typeof dSpec === 'string' && ['number', 'string', 'object', 'boolean'].includes(dSpec)) {
        // simple types
        if (typeof dVal !== specData.properties[dKey]) {
          throw new DbErrorBadRequest(`${name}: property ${dKey} has invalid data type`);
        }
      }
      else if (Array.isArray(dSpec) && dSpec[0].startsWith('#')) {
        const name = dSpec[0].slice(1);
        for (const item of dVal) {
          validate(name, item);
        }
      }
      else if (typeof dSpec === 'object') {
        // complex types
        const type = dSpec.type;
        assert.ok(['number', 'string', 'object', 'boolean'].includes(type),
          `invalid or missing type in spec ${JSON.stringify(dSpec)}`);
        if (type === 'string' && dSpec.enum) {
          assert.ok(Array.isArray(dSpec.enum), `enum must be an array ${JSON.stringify(dSpec.enum)}`);
          if (!dSpec.enum.includes(dVal)) {
            throw new DbErrorBadRequest(`invalid value ${dVal} must be one of ${dSpec.enum}`);
          }
        }
      }
      else if (typeof dSpec === 'string' && dSpec.startsWith('#')) {
        // reference to another datatype (i.e. nested type)
        const name = dSpec.slice(1);
        //const obj = {};
        //obj[name] = dVal;
        validate(name, dVal);
      }
      else {
        assert.ok(0, `invalid spec ${JSON.stringify(dSpec)}`);
      }
      required = required.filter((item) => item !== dKey);
    }
    else if (dKey === '_') {
      /* no op: allow arbitrary info to be carried here, used by conference e.g in transfer */
    }
    else throw new DbErrorBadRequest(`${name}: unknown property ${dKey}`);
  }
  if (required.length > 0) throw new DbErrorBadRequest(`${name}: missing value for ${required}`);
}

module.exports = validate;
