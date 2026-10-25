const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Metro must see the generated web entry during its initial file scan.
const cssCache = path.join(path.dirname(require.resolve('react-native-css-interop/package.json')), '.cache');
fs.mkdirSync(cssCache, { recursive: true });
const webCss = path.join(cssCache, 'web.css');
if (!fs.existsSync(webCss)) fs.writeFileSync(webCss, '');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './src/global.css', forceWriteFileSystem: true });
