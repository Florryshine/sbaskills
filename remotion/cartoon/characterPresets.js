/**
 * Character presets are data-only so a future asset pipeline can replace the
 * vector artwork without changing scene scripts or the animation API.
 */
export const CHARACTER_PRESETS = {
  tobi: {
    id: 'tobi',
    name: 'Tobi',
    description: 'A friendly teenage student in a blue hoodie.',
    palette: {
      skin: '#8B4F35',
      skinLight: '#A96547',
      skinShadow: '#673722',
      hair: '#17151B',
      hairLight: '#30252A',
      hoodie: '#1769AA',
      hoodieLight: '#3287C8',
      hoodieDark: '#104B80',
      trousers: '#26364A',
      shoe: '#F5F1E9',
      sole: '#D5D9DF',
      outline: '#30242A'
    },
    supportedExpressions: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'confused'],
    supportedPoses: ['standing', 'sitting', 'walking', 'pointing', 'waving']
  }
};

export function getCharacterPreset(id = 'tobi') {
  return CHARACTER_PRESETS[id] || CHARACTER_PRESETS.tobi;
}
