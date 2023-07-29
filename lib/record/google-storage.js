const { Storage } = require('@google-cloud/storage');
const { Writable } = require('stream');

class GoogleStorageUploadStream extends Writable {

  constructor(logger, opts) {
    super(opts);
    this.logger = logger;
    this.metadata = opts.metadata;

    const storage = new Storage(opts.bucketCredential);
    this.gcsFile = storage.bucket(opts.bucketName).file(opts.Key);
    this.writeStream = this.gcsFile.createWriteStream();

    this.writeStream.on('error', (err) => this.logger.error(err));
    this.writeStream.on('finish', () => {
      this.logger.info('google storage Upload completed.');
      this._addMetadata();
    });
  }

  _write(chunk, encoding, callback) {
    this.writeStream.write(chunk, encoding, callback);
  }

  _final(callback) {
    this.writeStream.end();
    this.writeStream.once('finish', callback);
  }

  async _addMetadata() {
    try {
      await this.gcsFile.setMetadata({metadata: this.metadata});
      this.logger.info('Google storage Upload and metadata setting completed.');
    } catch (err) {
      this.logger.error(err, 'Google storage  An error occurred while setting metadata');
    }
  }
}

module.exports = GoogleStorageUploadStream;
