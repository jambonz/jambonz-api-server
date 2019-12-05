function validate(number) {
  if (typeof number !== 'string') throw new Error('phone number must be a string');
  if (!/^\d+$/.test(number)) throw new Error('phone number must only include digits');
  if (number.length < 8) throw new Error('invalid phone number: insufficient digits');
  if (number[0] === '1' && number.length !== 11) throw new Error('invalid US phone number');
}

module.exports = validate;
