// Jest setup — polyfill Web Crypto + TextEncoder for jsdom. Node provides
// both natively but jsdom strips them. Lets pinStorage's SHA-256 hash run
// in tests without changing the production code path.
const nodeCrypto = require('crypto');
const nodeUtil = require('util');
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = nodeCrypto.webcrypto;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = nodeUtil.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = nodeUtil.TextDecoder;
}
