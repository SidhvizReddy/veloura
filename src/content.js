(() => {
  const box = document.createElement('div');
  box.id = 'wl-box';
  box.innerHTML = '<div id="wl-bg"><i class="b b1"></i><i class="b b2"></i><i class="b b3"></i><i class="b b4"></i></div><div id="wl-list"></div>';
  document.documentElement.appendChild(box);
  const list = box.querySelector('#wl-list'), bg = box.querySelector('#wl-bg');

  let lines = [], key = '', idx = -2, artUrl = '', video = null, boundVideo = null;

  // Floating button opens/closes the lyrics view. Choice is remembered.
  const btn = document.createElement('button');
  btn.id = 'wl-btn'; btn.type = 'button'; btn.textContent = '♪ Lyrics';
  document.documentElement.appendChild(btn);
  function setOpen(on) {
    box.classList.toggle('hidden', !on);
    btn.classList.toggle('on', on);
    try { localStorage.setItem('wl-open', on ? '1' : '0'); } catch (e) {}
    if (on) { poll(); syncLyrics(true); scroll(idx); }
  }
  const isOpen = () => !box.classList.contains('hidden');
  btn.onclick = () => setOpen(!isOpen());
  let saved = '0'; try { saved = localStorage.getItem('wl-open') || '0'; } catch (e) {}
  setOpen(saved === '1');

  // W = open/close, Shift+W = open covering the whole screen, Esc = back/close.
  // (L, F, J, K, M are YouTube Music shortcuts, so we avoid them and block our key from reaching the site.)
  addEventListener('keydown', e => {
    if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyW') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.shiftKey) { if (!isOpen()) setOpen(true); box.classList.toggle('full'); setTimeout(() => scroll(idx), 50); }
      else setOpen(!isOpen());
    } else if (e.key === 'Escape' && isOpen()) {
      if (box.classList.contains('full')) box.classList.remove('full'); else setOpen(false);
      setTimeout(() => scroll(idx), 50);
    }
  }, true);
  addEventListener('resize', () => scroll(idx));
  setInterval(() => {
    const p = document.querySelector('ytmusic-player-bar');
    document.documentElement.style.setProperty('--bar', ((p && p.offsetHeight) || 72) + 'px');
  }, 1000);

  function parse(lrc) {
    const out = [];
    lrc.split('\n').forEach(l => {
      const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      if (m && m[3].trim()) out.push({ t: +m[1] * 60 + +m[2], text: m[3].trim() });
    });
    out.sort((a, b) => a.t - b.t);
    out.forEach((ln, i) => {
      const end = i + 1 < out.length ? out[i + 1].t : ln.t + 4;
      const ws = ln.text.split(/\s+/);
      const weights = ws.map(w => w.length + 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const span = (end - ln.t) * 0.9;
      let acc = 0;
      ln.words = ws.map((w, j) => { const t = ln.t + span * acc / total; acc += weights[j]; return { w, t }; });
      ln.words.forEach((w, j) => { const nx = ln.words[j + 1]; w.d = Math.max(0.15, (nx ? nx.t : ln.t + span) - w.t); });
    });
    if (out.length && out[0].t > 3) out.unshift({ t: 0, dots: true, words: [] });
    return out;
  }

  function meta() {
    const m = navigator.mediaSession && navigator.mediaSession.metadata;
    if (m && m.title) return { title: m.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').trim(), artist: (m.artist || '').split(/[,&•]/)[0].trim() };
    const t = document.querySelector('ytmusic-player-bar .title'), b = document.querySelector('ytmusic-player-bar .byline');
    if (t && t.textContent.trim()) return { title: t.textContent.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').trim(), artist: (b ? b.textContent : '').split(/[,&•]/)[0].trim() };
    return null;
  }

  // ---- cover-art colors ----
  function art() {
    const m = navigator.mediaSession && navigator.mediaSession.metadata;
    if (m && m.artwork && m.artwork.length) return m.artwork[m.artwork.length - 1].src;
    const i = document.querySelector('ytmusic-player-bar img.image, #song-image img');
    return i ? i.src : '';
  }
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }
  function palette(img) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data, bk = {};
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = hsl(d[i], d[i + 1], d[i + 2]);
      if (l < 0.08 || l > 0.95) continue;
      const k = Math.round(h / 30) % 12, w = (0.05 + s * s) * (1.2 - Math.abs(l - 0.5));
      const o = bk[k] || (bk[k] = { n: 0, r: 0, g: 0, b: 0, k });
      o.n += w; o.r += d[i] * w; o.g += d[i + 1] * w; o.b += d[i + 2] * w;
    }
    const arr = Object.values(bk).sort((a, b) => b.n - a.n);
    if (!arr.length) return null;
    const a = arr[0], pick = [a];
    const far = (o, l) => l.every(p => { const dd = Math.abs(o.k - p.k); return Math.min(dd, 12 - dd) >= 2; });
    for (const o of arr.slice(1)) if (pick.length < 3 && o.n > a.n * 0.1 && far(o, pick)) pick.push(o);
    const cols = pick.map(o => hsl(o.r / o.n, o.g / o.n, o.b / o.n));
    while (cols.length < 3) { const [h, s, l] = cols[0]; cols.push([(h + (cols.length === 1 ? 40 : -40) + 360) % 360, s, l]); }
    return cols;
  }
  function vivid([h, s, l], dl = 0) {
    if (s > 0.12) s = Math.min(0.92, Math.max(0.55, s * 1.25));
    l = Math.min(0.54, Math.max(0.42, l)) + dl;
    return `hsl(${h | 0} ${(s * 100) | 0}% ${(l * 100) | 0}%)`;
  }
  function applyColor(url) {
    if (!url) return;
    chrome.runtime.sendMessage({ type: 'img', url }, res => {
      if (!res || !res.data) return;
      const img = new Image();
      img.onload = () => {
        try {
          const p = palette(img); if (!p) return;
          box.style.setProperty('--c1', vivid(p[0]));
          box.style.setProperty('--c2', vivid(p[1]));
          box.style.setProperty('--c3', vivid(p[2]));
          box.style.setProperty('--c4', vivid([(p[0][0] + 28) % 360, p[0][1], p[0][2]], 0.05));
          const bs = p[0][1] < 0.12 ? 0 : Math.min(0.7, Math.max(0.35, p[0][1]));
          if (bg.animate) bg.animate([{ opacity: 0.75 }, { opacity: 1 }], { duration: 1800, easing: 'ease-in-out' });
          box.style.setProperty('--base', `hsl(${p[0][0] | 0} ${(bs * 100) | 0}% 14%)`);
        } catch (e) {}
      };
      img.src = res.data;
    });
  }

  // ---- lyrics list ----
  function say(text) {
    lines = []; idx = -2; list.textContent = '';
    const el = document.createElement('div'); el.className = 'wl-l'; el.textContent = text; el.style.setProperty('--p', 100);
    list.appendChild(el);
    list.style.transform = `translateY(${box.clientHeight * 0.36}px)`;
  }
  function build() {
    list.textContent = '';
    lines.forEach(ln => {
      const el = document.createElement('div'); el.className = 'wl-l';
      if (ln.dots) { el.classList.add('wl-dots'); el.innerHTML = '<i></i><i></i><i></i>'; }
      else ln.words.forEach(w => {
        const s = document.createElement('span'); s.className = 'wl-w' + (w.d > 0.9 ? ' long' : ''); s.textContent = w.w;
        w.el = s; el.appendChild(s); el.appendChild(document.createTextNode(' '));
      });
      el.onclick = () => { const v = document.querySelector('video'); if (v) v.currentTime = ln.t; };
      ln.el = el; list.appendChild(el);
    });
    idx = -2;
  }
  function scroll(i) {
    const k = Math.max(i, 0), ln = lines[k];
    if (!ln) return;
    list.style.transform = `translateY(${box.clientHeight * 0.36 - (ln.el.offsetTop + ln.el.offsetHeight / 2)}px)`;
  }
  function styleLines(i) {
    const old = lines[idx];
    if (old && old.words) old.words.forEach(w => { w.el.style.removeProperty('--p'); w.el.classList.remove('now'); w.q = -1; w.nw = false; });
    lines.forEach((ln, k) => {
      const d = k - i, a = Math.abs(d), e = ln.el.style;
      e.visibility = a > 7 ? 'hidden' : 'visible';
      e.opacity = d === 0 ? 1 : d < 0 ? Math.max(0.12, 0.34 - a * 0.06) : Math.max(0.14, 0.55 - a * 0.07);
      e.filter = d === 0 ? 'none' : `blur(${Math.min(7, a * 1.3).toFixed(1)}px)`;
      e.transform = d === 0 ? 'scale(1)' : 'scale(.9)';
      e.setProperty('--p', d < 0 ? 100 : 0);
    });
    scroll(i);
  }

  // Slow work (track/cover/lyrics lookup) runs a few times a second, not every frame.
  function poll() {
    video = document.querySelector('video');
    if (video && video !== boundVideo) {
      boundVideo = video;
      ['timeupdate', 'seeking', 'seeked', 'play', 'playing', 'ratechange', 'loadedmetadata'].forEach(type =>
        video.addEventListener(type, () => syncLyrics(true))
      );
    }
    const m = meta();
    if (!video || !m) return;
    const u = art();
    if (u && u !== artUrl) { artUrl = u; applyColor(u); }
    const k = m.title + '|' + m.artist;
    if (k !== key) {
      key = k; say('♪');
      chrome.runtime.sendMessage({ type: 'lyrics', title: m.title, artist: m.artist, duration: Math.round(video.duration) || 0 }, res => {
        if (key !== k) return;
        if (res && res.synced) { lines = parse(res.synced); build(); }
        else say('No synced lyrics found');
      });
    }
  }
  setInterval(poll, 400); poll();

  // Read the media element's live clock and immediately align the displayed lyric.
  // This is also called by media events because requestAnimationFrame is throttled
  // aggressively while a tab is in the background.
  function syncLyrics(force = false) {
    if (!video || !video.isConnected) video = document.querySelector('video');
    if (!video || !lines.length) return;
    const t = video.currentTime;
    let i = -1;
    for (let j = 0; j < lines.length; j++) if (lines[j].t <= t) i = j;
    if (i !== idx) {
      if (!box.classList.contains('hidden')) styleLines(i);
      idx = i;
    } else if (force && !box.classList.contains('hidden')) {
      scroll(i);
    }
    const ln = lines[i];
    if (ln && ln.words) ln.words.forEach(w => {
      const q = Math.round(Math.max(0, Math.min(1, (t - w.t) / w.d)) * 100);
      if (q !== w.q) { w.q = q; w.el.style.setProperty('--p', q); }
      const nw = q > 0 && q < 100;
      if (nw !== w.nw) { w.nw = nw; w.el.classList.toggle('now', nw); }
    });
  }

  // Per-frame work remains as a smooth visual updater while the tab is active.
  function frame() {
    requestAnimationFrame(frame);
    if (document.visibilityState === 'visible') syncLyrics();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { poll(); syncLyrics(true); }
  });
  addEventListener('focus', () => { poll(); syncLyrics(true); });
  addEventListener('pageshow', () => { poll(); syncLyrics(true); });
  requestAnimationFrame(frame);
})();
