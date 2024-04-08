const sttGoogle = require('@google-cloud/speech').v1p1beta1;
const { TranscribeClient, ListVocabulariesCommand } = require('@aws-sdk/client-transcribe');
const { Deepgram } = require('@deepgram/sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { SpeechClient } = require('@soniox/soniox-node');
const bent = require('bent');
const fs = require('fs');
const { AssemblyAI } = require('assemblyai');
const {decrypt, obscureKey} = require('./encrypt-decrypt');

const TtsGoogleLanguagesVoices = require('./speech-data/tts-google');
const TtsAwsLanguagesVoices = require('./speech-data/tts-aws');
const TtsMicrosoftLanguagesVoices = require('./speech-data/tts-microsoft');
const TtsWellsaidLanguagesVoices = require('./speech-data/tts-wellsaid');
const TtsNuanceLanguagesVoices = require('./speech-data/tts-nuance');
const TtsIbmLanguagesVoices = require('./speech-data/tts-ibm');
const TtsNvidiaLanguagesVoices = require('./speech-data/tts-nvidia');
const TtsElevenlabsLanguagesVoices = require('./speech-data/tts-elevenlabs');
const TtsWhisperLanguagesVoices = require('./speech-data/tts-whisper');

const TtsModelDeepgram = require('./speech-data/tts-model-deepgram');
const TtsModelElevenLabs = require('./speech-data/tts-model-elevenlabs');
const TtsModelWhisper = require('./speech-data/tts-model-whisper');
const TtsModelPlayHT = require('./speech-data/tts-model-playht');

const SttGoogleLanguagesVoices = require('./speech-data/stt-google');
const SttAwsLanguagesVoices = require('./speech-data/stt-aws');
const SttMicrosoftLanguagesVoices = require('./speech-data/stt-microsoft');
const SttNuanceLanguagesVoices = require('./speech-data/stt-nuance');
const SttDeepgramLanguagesVoices = require('./speech-data/stt-deepgram');
const SttIbmLanguagesVoices = require('./speech-data/stt-ibm');
const SttNvidiaLanguagesVoices = require('./speech-data/stt-nvidia');
const SttCobaltLanguagesVoices = require('./speech-data/stt-cobalt');
const SttSonioxLanguagesVoices = require('./speech-data/stt-soniox');
const SttAssemblyaiLanguagesVoices = require('./speech-data/stt-assemblyai');

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

const testGoogleTts = async(logger, getTtsVoices, credentials) => {
  const voices = await getTtsVoices({vendor: 'google', credentials});
  return voices;

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

  if (process.env.JAMBONES_HTTP_PROXY_IP && process.env.JAMBONES_HTTP_PROXY_PORT) {
    logger.debug(
      `testMicrosoftStt: using proxy ${process.env.JAMBONES_HTTP_PROXY_IP}:${process.env.JAMBONES_HTTP_PROXY_PORT}`);
    speechConfig.setProxy(process.env.JAMBONES_HTTP_PROXY_IP, process.env.JAMBONES_HTTP_PROXY_PORT);
  }

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

const testAwsTts = async(logger, getTtsVoices, credentials) => {
  try {
    const voices = await getTtsVoices({vendor: 'aws', credentials});
    return voices;
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

const testMicrosoftTts = async(logger, synthAudio, credentials) => {
  try {
    await synthAudio({increment: () => {}, histogram: () => {}},
      {
        vendor: 'microsoft',
        credentials,
        language: 'en-US',
        voice: 'en-US-JennyMultilingualNeural',
        text: 'Hi there and welcome to jambones!'
      }
    );
  } catch (err) {
    logger.info({err}, 'testMicrosoftTts returned error');
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

const testElevenlabs = async(logger, credentials) => {
  const {api_key, model_id} = credentials;
  try {
    const post = bent('https://api.elevenlabs.io', 'POST', 'buffer', {
      'xi-api-key': api_key,
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json'
    });
    const mp3 = await post('/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      text: 'Hello',
      model_id,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    });
    return mp3;
  } catch (err) {
    logger.info({err}, 'synthEvenlabs returned error');
    throw err;
  }
};

const testPlayHT = async(logger, synthAudio, credentials) => {
  try {
    await synthAudio(
      {
        increment: () => {},
        histogram: () => {}
      },
      {
        vendor: 'playht',
        credentials,
        language: 'en-US',
        voice: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json',
        text: 'Hi there and welcome to jambones!'
      }
    );
  } catch (err) {
    logger.info({err}, 'synth Playht returned error');
    throw err;
  }
};

const testWhisper = async(logger, synthAudio, credentials) => {
  try {
    await synthAudio({increment: () => {}, histogram: () => {}},
      {
        vendor: 'whisper',
        credentials,
        language: 'en-US',
        voice: 'alloy',
        text: 'Hi there and welcome to jambones!'
      }
    );
  } catch (err) {
    logger.info({err}, 'synthEvenlabs returned error');
    throw err;
  }
};

const testDeepgramTTS = async(logger, synthAudio, credentials) => {
  try {
    await synthAudio({increment: () => {}, histogram: () => {}},
      {
        vendor: 'deepgram',
        credentials,
        model: 'aura-asteria-en',
        text: 'Hi there and welcome to jambones!'
      }
    );
  } catch (err) {
    logger.info({err}, 'testDeepgramTTS returned error');
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

const testAssemblyStt = async(logger, credentials) => {
  const {api_key} = credentials;

  const assemblyai = new AssemblyAI({
    apiKey: api_key
  });

  const audioUrl = `${__dirname}/../../data/test_audio.wav`;

  return new Promise((resolve, reject) => {
    assemblyai.transcripts
      .create({ audio_url: audioUrl })
      .then((transcript) => {
        logger.debug({transcript}, 'got transcription from AssemblyAi');
        if (transcript.status === 'error') {
          return reject({message: transcript.error});
        }
        return resolve(transcript.text);
      })
      .catch((err) => {
        logger.info({err}, 'failed to get assemblyAI transcription');
        reject(err);
      });
  });
};

const getSpeechCredential = (credential, logger) => {
  const {vendor} = credential;
  logger.info(
    `Speech vendor: ${credential.vendor} ${credential.label ? `, label: ${credential.label}` : ''} selected`);
  if ('google' === vendor) {
    try {
      const cred = JSON.parse(credential.service_key.replace(/\n/g, '\\n'));
      return {
        ...credential,
        credentials: cred
      };
    } catch (err) {
      logger.info({err}, `malformed google service_key provisioned for account ${credential.speech_credential_sid}`);
    }
  }
  else if (['aws', 'polly'].includes(vendor)) {
    return {
      ...credential,
      accessKeyId: credential.access_key_id,
      secretAccessKey: credential.secret_access_key,
      region: credential.aws_region || 'us-east-1'
    };
  }
  return credential;
};

function decryptCredential(obj, credential, logger, isObscureKey = true) {
  if ('google' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    const key_header = '-----BEGIN PRIVATE KEY-----\n';
    const obscured = {
      ...o,
      private_key: `${key_header}${isObscureKey ?
        obscureKey(o.private_key.slice(key_header.length, o.private_key.length)) :
        o.private_key.slice(key_header.length, o.private_key.length)}`
    };
    obj.service_key = JSON.stringify(obscured);
  }
  else if ('aws' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.access_key_id = o.access_key_id;
    obj.secret_access_key = isObscureKey ? obscureKey(o.secret_access_key) : o.secret_access_key;
    obj.aws_region = o.aws_region;
    logger.info({obj, o}, 'retrieving aws speech credential');
  }
  else if ('microsoft' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
    obj.region = o.region;
    obj.use_custom_tts = o.use_custom_tts;
    obj.custom_tts_endpoint = o.custom_tts_endpoint;
    obj.custom_tts_endpoint_url = o.custom_tts_endpoint_url;
    obj.use_custom_stt = o.use_custom_stt;
    obj.custom_stt_endpoint = o.custom_stt_endpoint;
    obj.custom_stt_endpoint_url = o.custom_stt_endpoint_url;
    logger.info({obj, o}, 'retrieving azure speech credential');
  }
  else if ('wellsaid' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
  }
  else if ('nuance' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.client_id = o.client_id;
    obj.secret = o.secret ? (isObscureKey ? obscureKey(o.secret) : o.secret) : null;
    obj.nuance_tts_uri = o.nuance_tts_uri;
    obj.nuance_stt_uri = o.nuance_stt_uri;
  }
  else if ('deepgram' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
    obj.deepgram_stt_uri = o.deepgram_stt_uri;
    obj.deepgram_stt_use_tls = o.deepgram_stt_use_tls;
  }
  else if ('ibm' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.tts_api_key = isObscureKey ? obscureKey(o.tts_api_key) : o.tts_api_key;
    obj.tts_region = o.tts_region;
    obj.stt_api_key = isObscureKey ? obscureKey(o.stt_api_key) : o.stt_api_key;
    obj.stt_region = o.stt_region;
    obj.instance_id = o.instance_id;
  } else if ('nvidia' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.riva_server_uri = o.riva_server_uri;
  } else if ('cobalt' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.cobalt_server_uri = o.cobalt_server_uri;
  } else if ('soniox' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
  } else if ('elevenlabs' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
    obj.model_id = o.model_id;
    obj.options = o.options;
  } else if ('playht' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
    obj.user_id = o.user_id;
    obj.voice_engine = o.voice_engine;
    obj.options = o.options;
  } else if (obj.vendor.startsWith('custom:')) {
    const o = JSON.parse(decrypt(credential));
    obj.auth_token = isObscureKey ? obscureKey(o.auth_token) : o.auth_token;
    obj.custom_stt_url = o.custom_stt_url;
    obj.custom_tts_url = o.custom_tts_url;
  } else if ('assemblyai' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
  } else if ('whisper' === obj.vendor) {
    const o = JSON.parse(decrypt(credential));
    obj.api_key = isObscureKey ? obscureKey(o.api_key) : o.api_key;
    obj.model_id = o.model_id;
  }
}

/**
 *
 * @param {*} logger logger
 * @param {*} vendor vendor
 * @param {*} credential STT/TTS vendor credential, can be null
 * @returns List of language and coresponding voices for specific vendor follow below format
 *  {
      "tts": [
        {
          code: "ar-XA",
          name: "Arabic",
          voices: [
            { value: "ar-XA-Standard-A", name: "Standard-A (Female)" },
          ]
        }
      ],
      "stt": [
        { name: "Afrikaans (South Africa)", code: "af-ZA" },
      ]
    }
 */
async function getLanguagesAndVoicesForVendor(logger, vendor, credential, getTtsVoices) {
  switch (vendor) {
    case 'google':
      return await getLanguagesVoicesForGoogle(credential, getTtsVoices, logger);
    case 'aws':
      return await getLanguagesVoicesForAws(credential, getTtsVoices, logger);
    case 'microsoft':
      return await getLanguagesVoicesForMicrosoft(credential, getTtsVoices, logger);
    case 'wellsaid':
      return await getLanguagesVoicesForWellsaid(credential, getTtsVoices, logger);
    case 'nuance':
      return await getLanguagesVoicesForNuane(credential, getTtsVoices, logger);
    case 'deepgram':
      return await getLanguagesVoicesForDeepgram(credential, getTtsVoices, logger);
    case 'ibm':
      return await getLanguagesVoicesForIbm(credential, getTtsVoices, logger);
    case 'nvidia':
      return await getLanguagesVoicesForNvida(credential, getTtsVoices, logger);
    case 'cobalt':
      return await getLanguagesVoicesForCobalt(credential, getTtsVoices, logger);
    case 'soniox':
      return await getLanguagesVoicesForSoniox(credential, getTtsVoices, logger);
    case 'elevenlabs':
      return await getLanguagesVoicesForElevenlabs(credential, getTtsVoices, logger);
    case 'playht':
      return await getLanguagesVoicesForPlayHT(credential, getTtsVoices, logger);
    case 'assemblyai':
      return await getLanguagesVoicesForAssemblyAI(credential, getTtsVoices, logger);
    case 'whisper':
      return await getLanguagesVoicesForWhisper(credential, getTtsVoices, logger);
    default:
      logger.info(`invalid vendor ${vendor}, return empty result`);
      throw new Error(`Invalid vendor ${vendor}`);
  }
}

async function getLanguagesVoicesForGoogle(credential, getTtsVoices, logger) {
  if (credential) {
    try {
      const [result] = await getTtsVoices({
        vendor: 'google',
        credentials: credential
      });
      const tts = parseGooglelanguagesVoices(result.voices);
      return tranform(tts, SttGoogleLanguagesVoices);
    } catch (err) {
      logger.info('Error while fetching google languages, voices, return predefined values', err);
    }
  }
  return tranform(TtsGoogleLanguagesVoices, SttGoogleLanguagesVoices);
}

async function getLanguagesVoicesForAws(credential, getTtsVoices, logger) {
  if (credential) {
    try {
      const result = await getTtsVoices({
        vendor: 'aws',
        credentials: {
          accessKeyId: credential.access_key_id,
          secretAccessKey: credential.secret_access_key,
          region: credential.aws_region || process.env.AWS_REGION
        }
      });
      const tts = parseAwsLanguagesVoices(result.Voices);
      return tranform(tts, SttAwsLanguagesVoices);
    } catch (err) {
      logger.info('Error while fetching AWS languages, voices, return predefined values', err);
    }
  }
  return tranform(TtsAwsLanguagesVoices, SttAwsLanguagesVoices);
}

async function getLanguagesVoicesForMicrosoft(credential, getTtsVoices, logger) {
  if (credential) {
    try {
      const get = bent('https://westus.tts.speech.microsoft.com', 'GET', 'json', {
        'Ocp-Apim-Subscription-Key' : credential.api_key
      });

      const voices = await get('/cognitiveservices/voices/list');
      const tts = parseMicrosoftLanguagesVoices(voices);
      return tranform(tts, SttMicrosoftLanguagesVoices);
    } catch (err) {
      logger.info('Error while fetching Microsoft languages, voices, return predefined values', err);
    }
  }
  return tranform(TtsMicrosoftLanguagesVoices, SttMicrosoftLanguagesVoices);
}

async function getLanguagesVoicesForWellsaid(credential) {
  return tranform(TtsWellsaidLanguagesVoices);
}

async function getLanguagesVoicesForNuane(credential, getTtsVoices, logger) {
  if (credential) {
    try {
      const result = await getTtsVoices({
        vendor: 'nuance',
        credentials: credential
      });
      const tts = parseNuanceLanguagesVoices(result.result.voices);
      return tranform(tts, SttNuanceLanguagesVoices);
    } catch (err) {
      logger.info('Error while fetching IBM languages, voices, return predefined values', err);
    }
  }
  return tranform(TtsNuanceLanguagesVoices, SttNuanceLanguagesVoices);
}

async function getLanguagesVoicesForDeepgram(credential) {
  return tranform(undefined, SttDeepgramLanguagesVoices, TtsModelDeepgram);
}

async function getLanguagesVoicesForIbm(credential, getTtsVoices, logger) {
  if (credential) {
    try {
      const result = await getTtsVoices({
        vendor: 'ibm',
        credentials: credential
      });
      const tts = parseIBMLanguagesVoices(result.result.voices);
      return tranform(tts, SttIbmLanguagesVoices);
    } catch (err) {
      logger.info('Error while fetching IBM languages, voices, return predefined values', err);
    }
  }
  return tranform(TtsIbmLanguagesVoices, SttIbmLanguagesVoices);
}

async function getLanguagesVoicesForNvida(credential) {
  return tranform(TtsNvidiaLanguagesVoices, SttNvidiaLanguagesVoices);
}

async function getLanguagesVoicesForCobalt(credential) {
  return tranform(undefined, SttCobaltLanguagesVoices);
}

async function getLanguagesVoicesForSoniox(credential) {
  return tranform(undefined, SttSonioxLanguagesVoices);
}

async function getLanguagesVoicesForElevenlabs(credential) {
  if (credential) {
    const get = bent('https://api.elevenlabs.io', 'GET', 'json', {
      'xi-api-key' : credential.api_key
    });

    const [langResp, voiceResp] = await Promise.all([get('/v1/models'), get('/v1/voices')]);

    const model = langResp.find((m) => m.model_id === credential.model_id);
    const languages = model ? model.languages.map((l) => {
      return {
        value: l.language_id,
        name: l.name
      };
    }).sort((a, b) => a.name.localeCompare(b.name)) : [];

    if (languages && languages.length > 0) {
      const voices = voiceResp ? voiceResp.voices.map((v) => {
        let name = `${v.name}${v.category !== 'premade' ? ` (${v.category})` : ''} -
  ${v.labels.accent ? ` ${v.labels.accent},` : ''}
  ${v.labels.description ? ` ${v.labels.description},` : ''}
  ${v.labels.age ? ` ${v.labels.age},` : ''}
  ${v.labels.gender ? ` ${v.labels.gender},` : ''}
  ${v.labels['use case'] ? ` ${v.labels['use case']},` : ''}
  `;
        const lastIndex = name.lastIndexOf(',');
        if (lastIndex !== -1) {
          name = name.substring(0, lastIndex);
        }
        return {
          value: v.voice_id,
          name
        };
      }).sort((a, b) => a.name.localeCompare(b.name)) : [];
      languages[0].voices = voices;
    }
    return tranform(languages, undefined, TtsModelElevenLabs);
  } else {
    return tranform(TtsElevenlabsLanguagesVoices, undefined, TtsModelElevenLabs);
  }
}

const concat = (a) => {
  return a ? ` ${a},` : '';
};

async function getLanguagesVoicesForPlayHT(credential) {
  if (credential) {
    const get = bent('https://api.play.ht', 'GET', 'json', {
      'AUTHORIZATION' : credential.api_key,
      'X-USER-ID': credential.user_id,
      'Accept': 'application/json'
    });

    const voices = await get('/api/v2/voices');

    const buildVoice = (d) => {
      let name = `${d.name} -${concat(d.accent)}${concat(d.age)}${concat(d.gender)}
${concat(d.loudness)}${concat(d.style)}${concat(d.tempo)}${concat(d.texture)}` ;
      name = name.endsWith(',') ? name.slice(0, -1) : name;
      return {
        value: `${d.id}`,
        name
      };
    };

    const ttsVoices = voices.reduce((acc, voice) => {
      const languageCode = voice.language_code;
      const existingLanguage = acc.find((lang) => lang.value === languageCode);
      if (existingLanguage) {
        existingLanguage.voices.push(buildVoice(voice));
      } else {
        acc.push({
          value: voice.language_code,
          name: voice.language,
          voices: [buildVoice(voice)]
        });
      }
      return acc;
    }, []);
    return tranform(ttsVoices, undefined, TtsModelPlayHT);
  }
  return tranform(undefined, undefined, TtsModelPlayHT);
}

async function getLanguagesVoicesForAssemblyAI(credential) {
  return tranform(undefined, SttAssemblyaiLanguagesVoices);
}

async function getLanguagesVoicesForWhisper(credential) {
  return tranform(TtsWhisperLanguagesVoices, undefined, TtsModelWhisper);
}

function tranform(tts, stt, models) {
  return {
    ...(tts && {tts}),
    ...(stt && {stt}),
    ...(models && {models})
  };
}

function parseGooglelanguagesVoices(data) {
  return data.reduce((acc, voice) => {
    const languageCode = voice.languageCodes[0];
    const existingLanguage = acc.find((lang) => lang.value === languageCode);

    if (existingLanguage) {
      existingLanguage.voices.push({
        value: voice.name,
        name: `${voice.name.substring(languageCode.length + 1, voice.name.length)} (${voice.ssmlGender})`
      });
    } else {
      acc.push({
        value: languageCode,
        name: SttGoogleLanguagesVoices.find((lang) => lang.value === languageCode)?.name || languageCode,
        voices: [{
          value: voice.name,
          name: `${voice.name.substring(languageCode.length + 1, voice.name.length)} (${voice.ssmlGender})`
        }]
      });
    }

    return acc;
  }, []);
}

function parseIBMLanguagesVoices(data) {
  return data.reduce((acc, voice) => {
    const languageCode = voice.language;
    const existingLanguage = acc.find((lang) => lang.value === languageCode);
    if (existingLanguage) {
      existingLanguage.voices.push({
        value: voice.name,
        name: `(${voice.gender}) ${voice.description}`
      });
    } else {
      acc.push({
        value: languageCode,
        name: SttGoogleLanguagesVoices.find((lang) => lang.value === languageCode)?.name || languageCode,
        voices: [{
          value: voice.name,
          name: `(${voice.gender}) ${voice.description}`
        }]
      });
    }
    return acc;
  }, []);
}

function parseAwsLanguagesVoices(data) {
  return data.reduce((acc, voice) => {
    const languageCode = voice.LanguageCode;
    const existingLanguage = acc.find((lang) => lang.value === languageCode);
    if (existingLanguage) {
      existingLanguage.voices.push({
        value: voice.Id,
        name: `(${voice.Gender}) ${voice.Name}`
      });
    } else {
      acc.push({
        value: languageCode,
        name: voice.LanguageName,
        voices: [{
          value: voice.Id,
          name: `(${voice.Gender}) ${voice.Name}`
        }]
      });
    }
    return acc;
  }, []);
}

function parseNuanceLanguagesVoices(data) {
  return data.reduce((acc, voice) => {
    const languageCode = voice.language;
    const existingLanguage = acc.find((lang) => lang.value === languageCode);
    if (existingLanguage) {
      existingLanguage.voices.push({
        value: voice.name,
        name: voice.name,
        model: voice.model
      });
    } else {
      acc.push({
        value: languageCode,
        name: SttGoogleLanguagesVoices.find((lang) => lang.value === languageCode)?.name || languageCode,
        voices: [{
          value: voice.name,
          name: voice.name,
          model: voice.model
        }]
      });
    }
    return acc;
  }, []);
}

function parseMicrosoftLanguagesVoices(data) {
  return data.reduce((acc, voice) => {
    const languageCode = voice.Locale;
    const existingLanguage = acc.find((lang) => lang.value === languageCode);
    if (existingLanguage) {
      existingLanguage.voices.push({
        value: voice.ShortName,
        name: `${voice.DisplayName} (${voice.Gender})`,
      });
    } else {
      acc.push({
        value: voice.Locale,
        name: voice.LocaleName,
        voices: [{
          value: voice.ShortName,
          name: `${voice.DisplayName} (${voice.Gender})`,
        }]
      });
    }
    return acc;
  }, []);
}

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
  testSonioxStt,
  testElevenlabs,
  testPlayHT,
  testAssemblyStt,
  testDeepgramTTS,
  getSpeechCredential,
  decryptCredential,
  testWhisper,
  getLanguagesAndVoicesForVendor
};
