const { Storage } = require('@google-cloud/storage');
const { Writable } = require('stream');
const streamBuffers = require('stream-buffers');

class GoogleStorageUploadStream extends Writable {

  constructor(logger, opts) {
    super(opts);
    this.logger = logger;
    this.metadata = opts.metadata;

    const storage = new Storage(opts.bucketCredential);
    this.gcsFile = storage.bucket(opts.bucketName).file(opts.Key);
    this.writeStream = this.gcsFile.createWriteStream();

    this.bufferSize = 2 * 1024 * 1024; // Buffer size set to 2MB
    this.buffer = new streamBuffers.WritableStreamBuffer({
      initialSize: this.bufferSize,
      incrementAmount: this.bufferSize
    });

    this.writeStream.on('error', (err) => this.logger.error(err));
    this.writeStream.on('finish', () => {
      this.logger.info('Google storage Upload completed.');
      this._addMetadata();
    });
  }

  _write(chunk, encoding, callback) {
    this.buffer.write(chunk, encoding);

    // Write to GCS when buffer reaches desired size
    if (this.buffer.size() >= this.bufferSize) {
      const dataToWrite = this.buffer.getContents();
      this.writeStream.write(dataToWrite, callback);
    } else {
      callback();
    }
  }

  _final(callback) {
    // Write any remaining data in the buffer to GCS
    if (this.buffer.size() > 0) {
      const remainingData = this.buffer.getContents();
      this.writeStream.write(remainingData);
    }

    this.writeStream.end();
    this.writeStream.once('finish', callback);
  }

  async _addMetadata() {
    try {
      await this.gcsFile.setMetadata({metadata: this.metadata});
      this.logger.info('Google storage Upload and metadata setting completed.');
    } catch (err) {
      this.logger.error(err, 'Google storage An error occurred while setting metadata');
    }
  }
}

module.exports = GoogleStorageUploadStream;
