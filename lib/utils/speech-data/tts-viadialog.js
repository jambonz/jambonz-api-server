/* fallback only: the live list comes from Viatone /v2/voices; voices are not tied to a language */
const voices = [
  'cecile', 'cecile_fast', 'cecile_7s', 'cecile_7s_b', 'cecile_10s', 'cecile_13s', 'cecile_14s', 'cecile_20s', 'maxime'
].map((v) => ({value: v, name: v}));

module.exports = [
  { value: 'fr-FR', name: 'French', voices },
  { value: 'en-US', name: 'English', voices },
  { value: 'nl-NL', name: 'Dutch', voices },
];
