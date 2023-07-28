
const path = require('node:path');
async function record(logger, socket, url) {
  const p = path.basename(url);
  const idx = p.lastIndexOf('/');
  const vendor = p.substring(idx + 1);
  switch (vendor) {
    case 'aws_s3':
      return require('./s3')(logger, socket);
    case 'google':
      return require('./google-storage')(logger, socket);
    default:
      logger.info(`unknown bucket vendor: ${vendor}`);
      socket.send(`unknown bucket vendor: ${vendor}`);
      socket.close();
  }
}

module.exports = record;
