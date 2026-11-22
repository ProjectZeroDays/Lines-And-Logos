'use strict';
/**
 * Line & Logo Studio — ZIP Writer (zero-dependency, deterministic)
 * ----------------------------------------------------------------
 * Produces standard ZIP archives (version 2.0, no compression — stored
 * entries) with deterministic timestamps so identical inputs produce
 * byte-identical archives. Suitable for brand-kit bundles.
 */

const EPOCH_DOS = { time: 0, date: 0x21 }; // 1980-01-01 00:00:00 (DOS epoch)

function dosDateTime(d) {
  if (!d) return EPOCH_DOS;
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Build a ZIP archive.
 * @param {Array<{name:string, data:Buffer|string, date?:Date}>} entries
 * @returns {Buffer}
 */
function buildZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('buildZip: at least one entry is required');
  }
  const seen = new Set();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error('buildZip: entry requires a name');
    }
    if (entry.name.includes('\\') || entry.name.startsWith('/') || entry.name.includes('..')) {
      throw new Error(`buildZip: unsafe entry name "${entry.name}"`);
    }
    if (seen.has(entry.name)) throw new Error(`buildZip: duplicate entry "${entry.name}"`);
    seen.add(entry.name);

    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const { time, date } = dosDateTime(entry.date || null);

    // Local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // UTF-8 flag
    local.writeUInt16LE(0, 8);           // method: stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(0, 14);          // CRC (data descriptor not used; filled below)
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, data);

    // Central directory record
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);        // version made by
    central.writeUInt16LE(20, 6);        // version needed
    central.writeUInt16LE(0x0800, 8);    // UTF-8 flag
    central.writeUInt16LE(0, 10);        // method
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(0, 18);        // CRC placeholder
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);        // extra len
    central.writeUInt16LE(0, 32);        // comment len
    central.writeUInt16LE(0, 34);        // disk number
    central.writeUInt16LE(0, 36);        // internal attrs
    central.writeUInt32LE(0, 38);        // external attrs
    central.writeUInt32LE(offset, 42);   // local header offset
    centralParts.push(central, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }

  // CRC must be computed over data; patch into local + central records.
  // Simplest correct approach: rebuild with CRCs computed up front.
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  // patch CRCs: localParts holds [header, name, data] per entry (3 items);
  // centralParts holds [record, name] per entry (2 items).
  for (let i = 0; i < entries.length; i++) {
    const data = Buffer.isBuffer(entries[i].data) ? entries[i].data : Buffer.from(String(entries[i].data), 'utf8');
    const crc = crc32(data);
    localParts[3 * i].writeUInt32LE(crc, 14);      // local header CRC field
    centralParts[2 * i].writeUInt32LE(crc, 18);  // central record CRC field
  }

  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16); // local parts total size == offset
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, end]);
}

module.exports = { buildZip };
