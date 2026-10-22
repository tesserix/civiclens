module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: { canvas: '#F6F7F2', forest: '#163D32', mint: '#DFF0D8', ink: '#182F29', muted: '#617168', line: '#E2E8DF', coral: '#F47954' } } },
};
