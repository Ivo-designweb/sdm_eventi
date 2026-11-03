// Creazione di file ZIP nel browser, senza librerie: ogni file viene compresso (deflate) se il browser lo permette, altrimenti inserito senza compressione.
(function () {
  const TAB = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  async function comprimi(dati) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const s = new Blob([dati]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch (e) { return null; }
  }

  function dosDataOra(d) {
    return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }

  // file: [{ nome: 'persone.json', dati: Uint8Array }] → Blob .zip
  async function crea(file, quando) {
    const enc = new TextEncoder(), dt = dosDataOra(quando || new Date());
    const parti = [], centrale = [];
    let pos = 0;
    for (const f of file) {
      const nome = enc.encode(f.nome), crc = crc32(f.dati);
      const compr = await comprimi(f.dati);
      const usa = compr && compr.length < f.dati.length;
      const corpo = usa ? compr : f.dati, metodo = usa ? 8 : 0;
      const lh = new Uint8Array(30 + nome.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, metodo, true);
      v.setUint16(10, dt.t, true); v.setUint16(12, dt.d, true); v.setUint32(14, crc, true); v.setUint32(18, corpo.length, true); v.setUint32(22, f.dati.length, true);
      v.setUint16(26, nome.length, true); v.setUint16(28, 0, true); lh.set(nome, 30);
      const ch = new Uint8Array(46 + nome.length), c = new DataView(ch.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, metodo, true);
      c.setUint16(12, dt.t, true); c.setUint16(14, dt.d, true); c.setUint32(16, crc, true); c.setUint32(20, corpo.length, true); c.setUint32(24, f.dati.length, true);
      c.setUint16(28, nome.length, true); c.setUint32(42, pos, true); ch.set(nome, 46);
      parti.push(lh, corpo); centrale.push(ch);
      pos += lh.length + corpo.length;
    }
    const dimCentrale = centrale.reduce((s, x) => s + x.length, 0);
    const fine = new Uint8Array(22), e = new DataView(fine.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, file.length, true); e.setUint16(10, file.length, true); e.setUint32(12, dimCentrale, true); e.setUint32(16, pos, true);
    return new Blob([...parti, ...centrale, fine], { type: 'application/zip' });
  }
  window.SdmZip = { crea, crc32 };
})();
