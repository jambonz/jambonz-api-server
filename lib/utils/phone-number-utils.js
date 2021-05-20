//const PNF = require('google-libphonenumber').PhoneNumberFormat;
//const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const validateNumber = (number) => {
  if (typeof number !== 'string') throw new Error('phone number must be a string');
  if (!/^\d+$/.test(number)) throw new Error('phone number must only include digits');
};

const e164 = (number) => {
  if (number.startsWith('+')) return number.slice(1);
  return number;
  /*
  const num = phoneUtil.parseAndKeepRawInput(number, 'US');
  if (!phoneUtil.isValidNumber(num)) throw new Error(`not a valid US telephone number: ${number}`);
  return phoneUtil.format(num, PNF.E164).slice(1);
  */
};

module.exports = {
  validateNumber,
  e164
};
