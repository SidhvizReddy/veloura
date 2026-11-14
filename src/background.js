// Lyrics from LRCLIB + cover-art fetching (so the page can read pixel colors without CORS issues).
async function getSynced(title, artist, duration) {
  const base = 'https://lrclib.net/api/';
  try {
    const q = new URLSearchParams({ track_name: title, artist_name: artist });
    if (duration) q.set('duration', duration);
    const r = await fetch(base + 'get?' + q);
    if (r.ok) { const j = await r.json(); if (j.syncedLyrics) return j.syncedLyrics; }
    const s = await fetch(base + 'search?' + new URLSearchParams({ track_name: title, artist_name: artist }));
    if (s.ok) { const list = await s.json(); const hit = list.find(x => x.syncedLyrics); if (hit) return hit.syncedLyrics; }
  } catch (e) {}
  return null;
}
async function getImage(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
  } catch (e) { return null; }
}
chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg.type === 'lyrics') { getSynced(msg.title, msg.artist, msg.duration).then(synced => send({ synced })); return true; }
  if (msg.type === 'img') { getImage(msg.url).then(data => send({ data })); return true; }
});
