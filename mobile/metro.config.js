const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css', inlineRem: 16 });

// With `expo start --tunnel` the phone only reaches Metro, so Metro forwards API calls to the
// backend on this PC (lib/config.ts points the app here when it runs through the tunnel).
const API_PATHS = ['/api/', '/uploads/', '/health'];
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhance ? enhance(middleware, server) : middleware;
  return (req, res, fallthrough) => {
    if (!API_PATHS.some((p) => req.url.startsWith(p))) return next(req, res, fallthrough);
    const upstream = http.request(
      { host: '127.0.0.1', port: 4000, path: req.url, method: req.method, headers: req.headers },
      (apiRes) => {
        res.writeHead(apiRes.statusCode, apiRes.headers);
        apiRes.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.statusCode = 502;
      res.end('Backend is not running on port 4000');
    });
    req.pipe(upstream);
  };
};

module.exports = config;
