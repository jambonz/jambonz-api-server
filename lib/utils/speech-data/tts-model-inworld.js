module.exports = [
  { name: 'Inworld TTS 2', value: 'inworld-tts-2' },
  { name: 'Llama Inworld TTS 1.5 Max', value: 'inworld-tts-1.5-max' },
  { name: 'Llama Inworld TTS 1.5 Mini', value: 'inworld-tts-1.5-mini' },
  /* the tts-1 generation returns no word timestamps, so it cannot support
     playout tracking / alignment-based barge-in; kept selectable for existing
     credentials but no longer offered as the default
   */
  { name: 'Llama Inworld TTS (Deprecated)', value: 'inworld-tts-1' },
  { name: 'Llama Inworld TTS Max (Deprecated)', value: 'inworld-tts-1-max' },
];

