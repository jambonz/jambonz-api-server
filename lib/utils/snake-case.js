
function snake(input) {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeCase(obj) {
  if (Array.isArray(obj)) {
    obj.forEach((r) => snakeCase(r));
  }
  else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      delete obj[key];
      obj[snake(key)] = value;
    });
  }
  else if (['string', 'number', 'boolean'].includes(typeof obj)) {
    obj = snake(obj);
  }
  return obj;
}

module.exports = snakeCase;
