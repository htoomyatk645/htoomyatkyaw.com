#!/usr/bin/env node
// Edit Framer CMS data (*.framercms) in place.
//
//   node tools/cms-edit.mjs --list <chunk>     print each item's fields
//   node tools/cms-edit.mjs                    apply tools/cms-edits.json
//
// Format (big-endian): the chunk file is u32 itemCount followed by the items
// back to back. An item is u16 fieldCount, then per field: u32 nameLength,
// name, u8 type, value. Types seen: 0x04 int64 (dates, ms), 0x0c string
// (u32 length + UTF-8), 0x0a JSON (u32 length + UTF-8, e.g. images),
// 0x0b rich text (u8 flag + u32 length + bytes).
//
// The indexes file points at items with 10-byte records: u16 chunk number,
// u32 offset, u32 length. Changing a string changes its item's length, so the
// chunk is rebuilt and every pointer record is rewritten; the indexes file
// keeps its size, so the index ranges hard-coded in the JS stay valid.

import fs from "node:fs";

function parseChunk(buf) {
  const count = buf.readUInt32BE(0);
  const items = [];
  let pos = 4;
  for (let i = 0; i < count; i++) {
    const start = pos;
    const n = buf.readUInt16BE(pos);
    pos += 2;
    const fields = [];
    for (let f = 0; f < n; f++) {
      const nameLen = buf.readUInt32BE(pos);
      const name = buf.toString("utf8", pos + 4, pos + 4 + nameLen);
      pos += 4 + nameLen;
      const type = buf[pos];
      pos += 1;
      let value;
      let raw;
      if (type === 0x04) {
        value = Number(buf.readBigInt64BE(pos));
        raw = buf.subarray(pos, pos + 8);
        pos += 8;
      } else if (type === 0x0c || type === 0x0a) {
        const len = buf.readUInt32BE(pos);
        value = buf.toString("utf8", pos + 4, pos + 4 + len);
        raw = buf.subarray(pos, pos + 4 + len);
        pos += 4 + len;
      } else if (type === 0x0b) {
        const len = buf.readUInt32BE(pos + 1);
        raw = buf.subarray(pos, pos + 5 + len);
        value = `<rich text ${len} bytes>`;
        pos += 5 + len;
      } else if (type === 0x00) {
        raw = Buffer.alloc(0);
        value = null;
      } else {
        throw new Error(`unknown field type 0x${type.toString(16)} at ${pos - 1} (field ${name})`);
      }
      fields.push({ name, type, value, raw });
    }
    items.push({ start, length: pos - start, fields });
  }
  if (pos !== buf.length) throw new Error(`parsed ${pos} of ${buf.length} bytes`);
  return items;
}

function encodeItem(item) {
  const parts = [Buffer.alloc(2)];
  parts[0].writeUInt16BE(item.fields.length);
  for (const f of item.fields) {
    const name = Buffer.from(f.name, "utf8");
    const head = Buffer.alloc(4);
    head.writeUInt32BE(name.length);
    parts.push(head, name, Buffer.from([f.type]));
    if (f.type === 0x04 && f.changed) {
      const v = Buffer.alloc(8);
      v.writeBigInt64BE(BigInt(f.value));
      parts.push(v);
    } else if ((f.type === 0x0c || f.type === 0x0a) && f.changed) {
      const s = Buffer.from(f.value, "utf8");
      const l = Buffer.alloc(4);
      l.writeUInt32BE(s.length);
      parts.push(l, s);
    } else {
      parts.push(f.raw);
    }
  }
  return Buffer.concat(parts);
}

function pointer(offset, length) {
  const b = Buffer.alloc(10);
  b.writeUInt16BE(0, 0);
  b.writeUInt32BE(offset, 2);
  b.writeUInt32BE(length, 6);
  return b;
}

if (process.argv[2] === "--list") {
  for (const item of parseChunk(fs.readFileSync(process.argv[3]))) {
    console.log(`\n# item @${item.start} len ${item.length}`);
    for (const f of item.fields) {
      const v = typeof f.value === "string" ? JSON.stringify(f.value.slice(0, 90)) : f.value;
      console.log(`  ${f.name} [0x${f.type.toString(16)}] ${v}`);
    }
  }
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync("tools/cms-edits.json", "utf8"));
for (const coll of config.collections) {
  const buf = fs.readFileSync(coll.chunk);
  const items = parseChunk(buf);
  let changes = 0;
  for (const item of items) {
    const slug = item.fields.find((f) => f.name === coll.slugField)?.value;
    const edits = coll.items[slug];
    if (!edits) continue;
    for (const [name, value] of Object.entries(edits)) {
      const f = item.fields.find((x) => x.name === name);
      if (!f) throw new Error(`${slug}: no field ${name}`);
      const next = f.type === 0x04 ? Date.parse(value) : value;
      if (f.value !== next) { f.value = next; f.changed = true; changes++; }
    }
  }
  // Rebuild the chunk and remap pointers.
  const header = buf.subarray(0, 4);
  const bodies = [];
  let offset = 4;
  const remap = [];
  for (const item of items) {
    const body = encodeItem(item);
    remap.push([pointer(item.start, item.length), pointer(offset, body.length)]);
    bodies.push(body);
    offset += body.length;
  }
  fs.writeFileSync(coll.chunk, Buffer.concat([header, ...bodies]));
  for (const indexFile of coll.indexes) {
    const idx = fs.readFileSync(indexFile);
    const out = Buffer.from(idx);
    for (const [from, to] of remap) {
      if (from.equals(to)) continue;
      let at = idx.indexOf(from);
      let hits = 0;
      while (at !== -1) { to.copy(out, at); hits++; at = idx.indexOf(from, at + 1); }
      if (!hits) throw new Error(`${indexFile}: pointer not found`);
    }
    fs.writeFileSync(indexFile, out);
  }
  parseChunk(fs.readFileSync(coll.chunk)); // sanity check
  console.log(`${coll.chunk.split("/").pop()}: ${changes} field changes`);
}
