/* global AFRAME, CONFIG, THREE */

/**
 * world-hdri-sky — мировое небо (не на камере / не на #player).
 *
 * Большая сфера в центре комнаты (CONFIG.room.sky).
 * HDR: room.hdri (отладка) → manifest/listing → {id}.* → base.* (без 404 в консоли).
 */
AFRAME.registerComponent('world-hdri-sky', {
  schema: {},

  init: function () {
    this._mesh = null;
    this._cfg = this._readCfg();
    this._buildSkyMesh(this._createFallbackTexture());
    this._tryLoadHdri();
  },

  remove: function () {
    if (this._mesh) {
      this.el.object3D.remove(this._mesh);
      if (this._mesh.geometry) this._mesh.geometry.dispose();
      if (this._mesh.material && this._mesh.material.map) {
        this._mesh.material.map.dispose();
      }
      if (this._mesh.material) this._mesh.material.dispose();
      this._mesh = null;
    }
  },

  _readCfg: function () {
    var room = (typeof CONFIG !== 'undefined' && CONFIG.room) || {};
    var sky = room.sky || {};
    var pos = sky.position || {};
    return {
      radius: sky.radius !== undefined ? sky.radius : 50,
      position: {
        x: pos.x !== undefined ? pos.x : 0,
        y: pos.y !== undefined ? pos.y : 1.5,
        z: pos.z !== undefined ? pos.z : 0,
      },
      exposure: sky.exposure !== undefined ? sky.exposure : 1.0,
      tint: new THREE.Color(sky.tint || '#ffffff'),
      fallback: sky.fallback || {},
      hdri: room.hdri || null,
      hdriAuto: room.hdriAuto === true,
      hdriDir: room.hdriDir || 'assets/hdri/',
      hdriBase: room.hdriBase !== undefined ? room.hdriBase : 'base',
      hdriExtensions: room.hdriExtensions || ['.hdr', '.jpg', '.jpeg', '.png'],
    };
  },

  _buildSkyMesh: function (texture) {
    if (this._mesh) {
      this.el.object3D.remove(this._mesh);
      if (this._mesh.geometry) this._mesh.geometry.dispose();
      if (this._mesh.material) this._mesh.material.dispose();
    }

    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    var geo = new THREE.SphereGeometry(this._cfg.radius, 64, 32);
    var mat = new THREE.MeshBasicMaterial({
      map: texture,
      color: this._cfg.tint,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.name = 'world-hdri-sky-mesh';
    this._mesh.frustumCulled = false;
    this._mesh.renderOrder = -100;

    this.el.object3D.position.set(
      this._cfg.position.x,
      this._cfg.position.y,
      this._cfg.position.z
    );
    this.el.object3D.add(this._mesh);
  },

  _applyTexture: function (texture) {
    if (!this._mesh || !texture) return;
    var old = this._mesh.material.map;
    this._mesh.material.map = texture;
    this._mesh.material.needsUpdate = true;
    if (old && old !== texture) old.dispose();
  },

  _createFallbackTexture: function () {
    var fb = this._cfg.fallback;
    var top = new THREE.Color(fb.topColor || '#0d1525');
    var horizon = new THREE.Color(fb.horizonColor || '#5a7088');
    var bottom = new THREE.Color(fb.bottomColor || '#1a2230');

    var w = 1024;
    var h = 512;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');

    for (var y = 0; y < h; y++) {
      var t = y / (h - 1);
      var col = new THREE.Color();
      if (t < 0.45) {
        col.copy(top).lerp(horizon, t / 0.45);
      } else {
        col.copy(horizon).lerp(bottom, (t - 0.45) / 0.55);
      }
      ctx.fillStyle = 'rgb(' +
        Math.round(col.r * 255) + ',' +
        Math.round(col.g * 255) + ',' +
        Math.round(col.b * 255) + ')';
      ctx.fillRect(0, y, w, 1);
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  },

  _findStartLocation: function () {
    var locs = (typeof CONFIG !== 'undefined' && CONFIG.locations) || [];
    var i;
    for (i = 0; i < locs.length; i++) {
      if (locs[i].start) return locs[i];
    }
    return locs.length ? locs[0] : null;
  },

  _locationSkyId: function (loc) {
    if (!loc) return null;
    if (loc.sky) return loc.sky;
    return loc.id || null;
  },

  _stemsForLocation: function (loc) {
    var skyId = this._locationSkyId(loc);
    var baseStem = this._cfg.hdriBase || 'base';
    var stems = [];
    if (skyId) stems.push(skyId);
    if (!skyId || skyId !== baseStem) stems.push(baseStem);
    return stems;
  },

  /** По manifest/listing: {id}.* → base.* без сетевых 404. */
  _pickSkyFile: function (names, loc) {
    var stems = this._stemsForLocation(loc);
    var exts = this._cfg.hdriExtensions;
    var lowerMap = {};
    var i;
    var s;
    var e;

    for (i = 0; i < names.length; i++) {
      lowerMap[names[i].toLowerCase()] = names[i];
    }

    for (s = 0; s < stems.length; s++) {
      for (e = 0; e < exts.length; e++) {
        var key = (stems[s] + exts[e]).toLowerCase();
        if (lowerMap[key]) return lowerMap[key];
      }
    }
    return null;
  },

  _tryLoadHdri: function () {
    var self = this;
    var dir = this._normalizeDir(this._cfg.hdriDir);

    if (this._cfg.hdri) {
      var debugUrl = this._normalizeHdriUrl(this._cfg.hdri, dir);
      if (debugUrl) this._loadSkyUrl(debugUrl);
      return;
    }

    this._fetchHdriFileNames(function (names) {
      var loc = self._findStartLocation();
      var skyId = self._locationSkyId(loc);
      var file = self._pickSkyFile(names, loc);

      if (file) {
        var url = dir + file;
        var stem = file.replace(/\.[^.]+$/, '');
        var via = stem === skyId ? skyId : (self._cfg.hdriBase || 'base');
        console.log('[world-hdri-sky] location:', skyId || '?', '→', via + ' (' + file + ')');
        self._loadSkyUrl(url);
        return;
      }

      if (self._cfg.hdriAuto && names.length) {
        var pick = names[Math.floor(Math.random() * names.length)];
        console.log('[world-hdri-sky] random:', pick);
        self._loadSkyUrl(dir + pick);
        return;
      }

      console.log('[world-hdri-sky] файл неба не найден — fallback-градиент');
    });
  },

  _fetchHdriFileNames: function (done) {
    var dir = this._normalizeDir(this._cfg.hdriDir);
    var self = this;

    fetch(dir + 'manifest.json')
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .catch(function () { return null; })
      .then(function (manifest) {
        if (manifest && Array.isArray(manifest) && manifest.length > 0) {
          return manifest;
        }
        return self._parseDirectoryListingNames(dir);
      })
      .then(function (names) { done(names || []); })
      .catch(function () { done([]); });
  },

  _normalizeDir: function (dir) {
    dir = (dir || 'assets/hdri/').replace(/\\/g, '/');
    if (dir.charAt(dir.length - 1) !== '/') dir += '/';
    return dir;
  },

  /** Любой href/имя → один URL: assets/hdri/файл.hdr (без двойного префикса). */
  _normalizeHdriUrl: function (href, dir) {
    if (!href) return null;
    href = String(href).replace(/\\/g, '/').split('?')[0].split('#')[0];
    if (/^https?:\/\//.test(href)) return href;
    if (href.charAt(0) === '/') return href;
    var name = href.split('/').pop();
    if (!name || name === '.' || name === '..') return null;
    return dir + name;
  },

  _parseDirectoryListingNames: function (dir) {
    return fetch(dir)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        if (!html) return [];
        var extRe = /\.(hdr|jpg|jpeg|png)(\?|#|$)/i;
        var hrefRe = /href="([^"]+)"/gi;
        var names = [];
        var seen = {};
        var m;

        while ((m = hrefRe.exec(html)) !== null) {
          var href = decodeURIComponent(m[1]);
          if (href.indexOf('..') === 0 || href === './' || href.endsWith('/')) continue;
          if (!extRe.test(href)) continue;

          var normalized = href.replace(/\\/g, '/');
          var base = normalized.split('/').pop().split('?')[0].split('#')[0];
          if (!base || seen[base]) continue;
          seen[base] = true;
          names.push(base);
        }

        return names;
      });
  },

  _loadSkyUrl: function (url, onFail) {
    var lower = url.toLowerCase().split('?')[0].split('#')[0];
    if (lower.endsWith('.hdr')) {
      this._loadHdr(url, onFail);
    } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
      this._loadLdr(url, onFail);
    } else {
      console.warn('[world-hdri-sky] unsupported extension:', url);
      if (onFail) onFail();
    }
  },

  _loadLdr: function (url, onFail) {
    var loader = new THREE.TextureLoader();
    var self = this;
    loader.load(
      url,
      function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        self._applyTexture(tex);
        console.log('[world-hdri-sky] loaded LDR sky:', url);
      },
      undefined,
      function () {
        if (onFail) onFail();
        else console.warn('[world-hdri-sky] LDR not found, using fallback:', url);
      }
    );
  },

  _loadHdr: function (url, onFail) {
    var self = this;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      if (xhr.status !== 200) {
        if (onFail) onFail();
        else console.warn('[world-hdri-sky] HDR not found, using fallback:', url);
        return;
      }
      try {
        var parsed = parseRGBEToUint8(xhr.response, self._cfg.exposure);
        var tex = new THREE.DataTexture(
          parsed.data,
          parsed.width,
          parsed.height,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );
        tex.needsUpdate = true;
        tex.flipY = true;
        self._applyTexture(tex);
        console.log('[world-hdri-sky] loaded HDR sky:', url);
      } catch (e) {
        console.warn('[world-hdri-sky] HDR parse failed:', e.message);
        if (onFail) onFail();
      }
    };
    xhr.onerror = function () {
      if (onFail) onFail();
      else console.warn('[world-hdri-sky] HDR fetch failed:', url);
    };
    xhr.send();
  },
});

/**
 * Парсер Radiance .hdr → Uint8 RGBA (LDR после exposure).
 * Устойчив к CRLF, пустым строкам в header, ±Y/±X.
 */
function parseRGBEToUint8(buffer, exposure) {
  var exp = exposure !== undefined ? exposure : 1.0;
  var byteArray = new Uint8Array(buffer);
  byteArray.pos = 0;

  if (isOpenExrBuffer(byteArray)) {
    throw new Error('OpenEXR — экспортируй Radiance .hdr или положи .jpg');
  }

  var header = readRGBEHeader(byteArray);
  var w = header.width;
  var h = header.height;
  var rgba = readRGBEPixels(byteArray, w, h);

  var out = new Uint8Array(w * h * 4);
  for (var i = 0; i < w * h; i++) {
    var o = i * 4;
    var e = rgba[o + 3];
    var scale = Math.pow(2.0, e - 128.0) / 255.0 * exp;
    out[o]     = toneMapChannel(rgba[o]     * scale);
    out[o + 1] = toneMapChannel(rgba[o + 1] * scale);
    out[o + 2] = toneMapChannel(rgba[o + 2] * scale);
    out[o + 3] = 255;
  }

  return { width: w, height: h, data: out };
}

function isOpenExrBuffer(buffer) {
  return buffer.byteLength >= 4 &&
    buffer[0] === 0x76 && buffer[1] === 0x2f &&
    buffer[2] === 0x31 && buffer[3] === 0x01;
}

function toneMapChannel(v) {
  v = Math.max(0, v);
  v = v / (1.0 + v);
  return Math.min(255, Math.round(v * 255));
}

function readRGBEHeader(buffer) {
  buffer.pos = 0;
  if (buffer.byteLength >= 3 &&
      buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    buffer.pos = 3;
  }

  var width = 0;
  var height = 0;

  while (buffer.pos < buffer.byteLength) {
    var line = rgbeFgets(buffer);
    if (line === null) break;

    var dimMatch = line.match(/[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/i);
    if (dimMatch) {
      height = parseInt(dimMatch[1], 10);
      width = parseInt(dimMatch[2], 10);
      break;
    }
  }

  if (!width || !height) throw new Error('missing RGBE dimensions');
  return { width: width, height: height };
}

/** null = EOF, '' = пустая строка в header. */
function rgbeFgets(buffer) {
  if (buffer.pos >= buffer.byteLength) return null;
  var line = '';
  while (buffer.pos < buffer.byteLength) {
    var c = buffer[buffer.pos++];
    if (c === 0x0A) return line;
    if (c !== 0x0D) line += String.fromCharCode(c);
  }
  return line;
}

function readRGBEPixels(buffer, w, h) {
  var scanline = w;
  var data = new Uint8Array(buffer.subarray(buffer.pos));

  if (data.length === 4 * w * h) {
    return data;
  }

  if (data[0] !== 2 || data[1] !== 2 || (data[2] & 0x80)) {
    return new Uint8Array(data.subarray(0, 4 * w * h));
  }

  var out = new Uint8Array(4 * w * h);
  var offset = 0;
  var pos = 0;

  for (var y = 0; y < h; y++) {
    if (pos + 4 > data.length) throw new Error('RGBE RLE truncated');

    if (data[pos] !== 2 || data[pos + 1] !== 2) throw new Error('bad RGBE RLE scan');
    var lineWidth = (data[pos + 2] << 8) | data[pos + 3];
    if (lineWidth !== scanline) throw new Error('RGBE scanline width mismatch');
    pos += 4;

    var scan = new Uint8Array(4 * scanline);
    var ptr = 0;

    while (ptr < 4 * scanline) {
      var count = data[pos++];
      if (count > 128) {
        count -= 128;
        var val = data[pos++];
        for (var k = 0; k < count; k++) scan[ptr++] = val;
      } else {
        scan.set(data.subarray(pos, pos + count), ptr);
        ptr += count;
        pos += count;
      }
    }

    for (var x = 0; x < scanline; x++) {
      out[offset] = scan[x];
      out[offset + 1] = scan[x + scanline];
      out[offset + 2] = scan[x + scanline * 2];
      out[offset + 3] = scan[x + scanline * 3];
      offset += 4;
    }
  }

  return out;
}
