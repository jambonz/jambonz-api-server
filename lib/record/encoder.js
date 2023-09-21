const { Transform } = require('stream');
const lamejs = require('@jambonz/lamejs');

class PCMToMP3Encoder extends Transform {
  constructor(options, logger) {
    super(options);

    const channels = options.channels || 1;
    const sampleRate = options.sampleRate || 8000;
    const bitRate = options.bitRate || 128;

    this.encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
    this.channels = channels;
    this.logger = logger;
  }

  _transform(chunk, encoding, callback) {
    try {
      // Convert chunk buffer into Int16Array for lamejs
      const samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);

      // Split input samples into left and right channel arrays if stereo
      let leftChannel, rightChannel;
      if (this.channels === 2) {
        leftChannel = new Int16Array(samples.length / 2);
        rightChannel = new Int16Array(samples.length / 2);

        for (let i = 0; i < samples.length; i += 2) {
          leftChannel[i / 2] = samples[i];
          rightChannel[i / 2] = samples[i + 1];
        }
      } else {
        leftChannel = samples;
      }

      // Encode the input data
      const mp3Data = this.encoder.encodeBuffer(leftChannel, rightChannel);

      if (mp3Data.length > 0) {
        this.push(Buffer.from(mp3Data));
      }
      callback();
    } catch (err) {
      this.logger.error(
        { err },
        'Error while mp3 transform');
    }
  }

  _flush(callback) {
    // Finalize encoding and flush the internal buffers
    const mp3Data = this.encoder.flush();

    if (mp3Data.length > 0) {
      this.push(Buffer.from(mp3Data));
    }
    callback();
  }
}

module.exports = PCMToMP3Encoder;
