module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: { canvas: '#F7F8FA', primary: '#3858F5', tint: '#EEF1FF', ink: '#151923', muted: '#717887', line: '#E5E7EB', accent: '#D3F36B' } } },
};
