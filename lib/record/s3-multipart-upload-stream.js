const { Writable } = require('stream');
const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} = require('@aws-sdk/client-s3');

class S3MultipartUploadStream extends Writable {
  constructor(logger, opts) {
    super(opts);
    this.logger = logger;
    this.bucketName = opts.bucketName;
    this.objectKey = opts.Key;
    this.uploadId = null;
    this.partNumber = 1;
    this.multipartETags = [];
    this.buffer = Buffer.alloc(0);
    this.minPartSize = 5 * 1024 * 1024; // 5 MB
    this.s3 = new S3Client(opts.bucketCredential);
    this.metadata = opts.metadata;
  }

  async _initMultipartUpload() {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      Metadata: this.metadata
    });
    const response = await this.s3.send(command);
    return response.UploadId;
  }

  async _uploadBuffer() {
    const uploadPartCommand = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      PartNumber: this.partNumber,
      UploadId: this.uploadId,
      Body: this.buffer,
    });

    const uploadPartResponse = await this.s3.send(uploadPartCommand);
    this.multipartETags.push({
      ETag: uploadPartResponse.ETag,
      PartNumber: this.partNumber,
    });
    this.partNumber += 1;
  }

  async _write(chunk, encoding, callback) {
    try {
      if (!this.uploadId) {
        this.uploadId = await this._initMultipartUpload();
      }

      this.buffer = Buffer.concat([this.buffer, chunk]);

      if (this.buffer.length >= this.minPartSize) {
        await this._uploadBuffer();
        this.buffer = Buffer.alloc(0);
      }

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async _finalize(err) {
    try {
      if (this.buffer.length > 0) {
        await this._uploadBuffer();
      }

      const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: this.objectKey,
        MultipartUpload: {
          Parts: this.multipartETags.sort((a, b) => a.PartNumber - b.PartNumber),
        },
        UploadId: this.uploadId,
      });

      await this.s3.send(completeMultipartUploadCommand);
      this.logger.info('Finished upload to S3');
    } catch (error) {
      this.logger.error('Error completing multipart upload:', error);
      throw error;
    }
  }

  async _final(callback) {
    try {
      await this._finalize();
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = S3MultipartUploadStream;
