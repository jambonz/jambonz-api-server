
function snake(input) {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeCase(obj) {
  if (Array.isArray(obj)) {
    obj.forEach((r) => snakeCase(r));
  }
  else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      obj[snake(key)] = obj[key];
      delete obj[key];
    });
  }
  else if (typeof obj === 'string') {
    obj = snake(obj);
  }
  return obj;
}

module.exports = snakeCase;
