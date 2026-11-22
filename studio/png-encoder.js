'use strict';
/**
 * Line & Logo Studio — Deterministic PNG Encoder (zero-dependency)
 * ----------------------------------------------------------------
 * Implements PNG signature, IHDR, IDAT (zlib/deflate via raw DEFLATE
 * stored blocks + Adler-32 — deterministic, no compression library),
 * IEND. CRC-32 per PNG spec.
 *
 * For brand-kit exports we favor determinism over compression ratio:
 * stored (uncompressed) DEFLATE blocks are used. Output is valid PNG,
 * opens in every viewer, and byte-identical for identical input.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
  let a = 1, b = 0;
  const MOD = 65521;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Encode RGBA pixels to PNG.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array|Buffer} rgba length width*height*4
 * @returns {Buffer} PNG file bytes
 */
function encodePng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('encodePng: invalid dimensions');
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePng: expected ${width * height * 4} bytes, got ${rgba.length}`);
  }

  // raw scanlines with filter byte 0 (None) per row
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  // zlib wrapper: 0x78 0x01 (deflate, no compression hint) + DEFLATE stored blocks + adler32
  const maxBlock = 65535;
  const blocks = [];
  for (let off = 0; off < raw.length; off += maxBlock) {
    const len = Math.min(maxBlock, raw.length - off);
    const final = off + len >= raw.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 0x01 : 0x00;          // BFINAL
    header.writeUInt16LE(len, 1);             // LEN
    header.writeUInt16LE(~len & 0xffff, 3);   // NLEN
    blocks.push(header, raw.subarray(off, off + len));
  }
  const zlib = Buffer.concat([
    Buffer.from([0x78, 0x01]),
    ...blocks,
    (() => { const a = Buffer.alloc(4); a.writeUInt32BE(adler32(raw), 0); return a; })(),
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { encodePng, crc32, adler32 };
