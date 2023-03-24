const ttsGoogle = require('@google-cloud/text-to-speech');
const sttGoogle = require('@google-cloud/speech').v1p1beta1;
const { PollyClient, DescribeVoicesCommand } = require('@aws-sdk/client-polly');
const { TranscribeClient, ListVocabulariesCommand } = require('@aws-sdk/client-transcribe');
const { Deepgram } = require('@deepgram/sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { SpeechClient } = require('@soniox/soniox-node');
const bent = require('bent');
const fs = require('fs');


const testSonioxStt = async(logger, credentials) => {
  const api_key = credentials;
  const soniox = new SpeechClient(api_key);

  return new Promise(async(resolve, reject) => {
    try {
      const result = await soniox.transcribeFileShort('data/test_audio.wav');
      if (result.words.length > 0) resolve(result);
      else reject(new Error('no transcript returned'));
    } catch (error) {
      logger.info({error}, 'failed to get soniox transcript');
      reject(error);
    }
  });
};

const testNuanceTts = async(logger, getTtsVoices, credentials) => {
  const voices = await getTtsVoices({vendor: 'nuance', credentials});
  return voices;
};
const testNuanceStt = async(logger, credentials) => {
  //TODO
  return true;
};

const testGoogleTts = async(logger, credentials) => {
  const client = new ttsGoogle.TextToSpeechClient({credentials});
  await client.listVoices();
};

const testGoogleStt = async(logger, credentials) => {
  const client = new sttGoogle.SpeechClient({credentials});
  const config = {
    sampleRateHertz: 8000,
    languageCode: 'en-US',
    model: 'default',
  };
  const audio = {
    content: fs.readFileSync(`${__dirname}/../../data/test_audio.wav`).toString('base64'),
  };
  const request = {
    config: config,
    audio: audio,
  };

  // Detects speech in the audio file
  const [response] = await client.recognize(request);
  if (!Array.isArray(response.results) || 0 === response.results.length) {
    throw new Error('failed to transcribe speech');
  }
};

const testDeepgramStt = async(logger, credentials) => {
  const {api_key} = credentials;
  const deepgram = new Deepgram(api_key);

  const mimetype = 'audio/wav';
  const source = {
    buffer: fs.readFileSync(`${__dirname}/../../data/test_audio.wav`),
    mimetype: mimetype
  };

  return new Promise((resolve, reject) => {
    // Send the audio to Deepgram and get the response
    deepgram.transcription
      .preRecorded(source, {punctuate: true})
      .then((response) => {
        //logger.debug({response}, 'got transcript');
        if (response?.results?.channels[0]?.alternatives?.length > 0) resolve(response);
        else reject(new Error('no transcript returned'));
        return;
      })
      .catch((err) => {
        logger.info({err}, 'failed to get deepgram transcript');
        reject(err);
      });
  });
};

const testMicrosoftStt = async(logger, credentials) => {
  const {api_key, region} = credentials;

  const speechConfig = sdk.SpeechConfig.fromSubscription(api_key, region);
  const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(`${__dirname}/../../data/test_audio.wav`));
  speechConfig.speechRecognitionLanguage = 'en-US';
  const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    speechRecognizer.recognizeOnceAsync((result) => {
      switch (result.reason) {
        case sdk.ResultReason.RecognizedSpeech:
          resolve();
          break;
        case sdk.ResultReason.NoMatch:
          reject('Speech could not be recognized.');
          break;
        case sdk.ResultReason.Canceled:
          const cancellation = sdk.CancellationDetails.fromResult(result);
          logger.info(`CANCELED: Reason=${cancellation.reason}`);
          if (cancellation.reason == sdk.CancellationReason.Error) {
            logger.info(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
            logger.info(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
          }
          reject(cancellation.reason);
          break;
      }
      speechRecognizer.close();
    });
  });
};

const testAwsTts = async(logger, credentials) => {
  try {
    const {region, accessKeyId, secretAccessKey} = credentials;
    const client = new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    const command = new DescribeVoicesCommand({LanguageCode: 'en-US'});
    const response = await client.send(command);
    return response;
  } catch (err) {
    logger.info({err}, 'testMicrosoftTts - failed to list voices for region ${region}');
    throw err;
  }
};

const testAwsStt = async(logger, credentials) => {
  try {
    const {region, accessKeyId, secretAccessKey} = credentials;
    const client = new TranscribeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    const command = new ListVocabulariesCommand({});
    const response =  await client.send(command);
    return response;
  } catch (err) {
    logger.info({err}, 'testMicrosoftTts - failed to list voices for region ${region}');
    throw err;
  }
};

const testMicrosoftTts = async(logger, credentials) => {
  const {
    api_key,
    region,
    // eslint-disable-next-line no-unused-vars
    use_custom_tts,
    // eslint-disable-next-line no-unused-vars
    custom_tts_endpoint,
    // eslint-disable-next-line no-unused-vars
    use_custom_stt,
    // eslint-disable-next-line no-unused-vars
    custom_stt_endpoint
  } = credentials;

  logger.info({
    api_key,
    region,
    use_custom_tts,
    custom_tts_endpoint,
    use_custom_stt,
    custom_stt_endpoint
  }, 'testing microsoft tts');
  if (!api_key) throw new Error('testMicrosoftTts: credentials are missing api_key');
  if (!region) throw new Error('testMicrosoftTts: credentials are missing region');
  try {
    const getJSON = bent('json', {
      'Ocp-Apim-Subscription-Key': api_key
    });
    const response = await getJSON(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`);
    return response;
  } catch (err) {
    logger.info({err}, `testMicrosoftTts - failed to list voices for region ${region}`);
    throw err;
  }
};

const testWellSaidTts = async(logger, credentials) => {
  const {api_key} = credentials;
  try {
    const post = bent('https://api.wellsaidlabs.com', 'POST', 'buffer', {
      'X-Api-Key': api_key,
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json'
    });
    const mp3 = await post('/v1/tts/stream', {
      text: 'Hello, world',
      speaker_id: '3'
    });
    return mp3;
  } catch (err) {
    logger.info({err}, 'testWellSaidTts returned error');
    throw err;
  }
};

const testIbmTts = async(logger, getTtsVoices, credentials) => {
  const {tts_api_key, tts_region} = credentials;
  const voices = await getTtsVoices({vendor: 'ibm', credentials: {tts_api_key, tts_region}});
  return voices;
};

const testIbmStt = async(logger, credentials) => {
  const {stt_api_key, stt_region} = credentials;
  const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
  const { IamAuthenticator } = require('ibm-watson/auth');
  const speechToText = new SpeechToTextV1({
    authenticator: new IamAuthenticator({
      apikey: stt_api_key
    }),
    serviceUrl: `https://api.${stt_region}.speech-to-text.watson.cloud.ibm.com`
  });
  return new Promise((resolve, reject) => {
    speechToText.listModels()
      .then((speechModels) => {
        logger.debug({speechModels}, 'got IBM speech models');
        return resolve();
      })
      .catch((err) => {
        logger.info({err}, 'failed to get speech models');
        reject(err);
      });
  });
};

const testWellSaidStt = async(logger, credentials) => {
  //TODO
  return true;
};

module.exports = {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testWellSaidTts,
  testAwsStt,
  testMicrosoftTts,
  testMicrosoftStt,
  testWellSaidStt,
  testNuanceTts,
  testNuanceStt,
  testDeepgramStt,
  testIbmTts,
  testIbmStt,
  testSonioxStt
};
