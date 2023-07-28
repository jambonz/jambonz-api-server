const { Storage } = require('@google-cloud/storage');
const { Writable } = require('stream');

class GoogleStorageUploadStream extends Writable {

  constructor(logger, opts) {
    super(opts);
    this.logger = logger;

    const storage = new Storage(opts.bucketCredential);
    this.gcsFile = storage.bucket(opts.bucketName).file(opts.Key);
    this.writeStream = this.gcsFile.createWriteStream({
      metadata: opts.metadata
    });

    this.writeStream.on('error', (err) => this.logger.error(err));
    this.writeStream.on('finish', () => this.logger.log('Upload completed.'));
  }

  _write(chunk, encoding, callback) {
    this.writeStream.write(chunk, encoding, callback);
  }

  _final(callback) {
    this.writeStream.end();
    this.writeStream.once('finish', callback);
  }
}

module.exports = GoogleStorageUploadStream;
