// The home page's widgets, in the way of the small widgets on a Mac desktop: the time and weather in Halle (Saale),
// the latest project (from projects.js) and the music Eric is listening to. The markup is in
// index.html; this fills it in and keeps it current. Styles: widgets.css.
//
//   import { mountWidgets } from './widgets.js';
//   mountWidgets(document.querySelector('.widgets'));

import { PROJECTS } from './projects.js';

// ---- the settings: change these by hand ----

// the music widget reads the last track from Last.fm (Spotify can scrobble to it: last.fm/settings/applications).
// Without a user and an API key (last.fm/api/account/create) it shows the favourite song instead (the cover is
// Apple Music's, linked, not copied)
export const LASTFM = { user: '', key: '' };
const FAVOURITE = {
  title: 'Is There Really No Happiness?',
  artist: 'Porter Robinson',
  art: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/fc/9b/64fc9be4-3a08-0745-f3c5-7fff92620e9a/810090095004_Cover.jpg/300x300bb.jpg',
};

// where the time and the weather are from (only the city is ever shown)
const PLACE = { lat: 51.48, lon: 11.97, zone: 'Europe/Berlin' };

// ---- behaviour ----

// WMO weather codes (open-meteo.com) -> words and a Material Symbols icon, by day and by night
function weather(code, day) {
  if (code === 0) return ['clear', day ? 'clear_day' : 'clear_night'];
  if (code <= 2) return ['partly cloudy', day ? 'partly_cloudy_day' : 'partly_cloudy_night'];
  if (code === 3) return ['cloudy', 'cloud'];
  if (code <= 48) return ['foggy', 'foggy'];
  if (code <= 67 || (code >= 80 && code <= 82)) return ['rain', 'rainy'];
  if (code <= 77 || code === 85 || code === 86) return ['snow', 'weather_snowy'];
  return ['thunderstorm', 'thunderstorm'];
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mountWidgets(root) {
  if (!root) return;
  const $ = s => root.querySelector(s);

  // the time, every few seconds, and the date under it
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: PLACE.zone });
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: PLACE.zone });
  const tick = () => {
    const now = new Date();
    $('.w-time').textContent = time.format(now);
    $('.w-date').textContent = date.format(now).toLowerCase();
  };
  tick();
  setInterval(tick, 5000);

  // the weather, now and every 15 minutes; if it cannot be fetched the widget simply shows the time
  const sky = async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=${encodeURIComponent(PLACE.zone)}`;
      const d = await (await fetch(url)).json();
      const [words, icon] = weather(d.current.weather_code, d.current.is_day === 1);
      $('.w-temp').textContent = `${Math.round(d.current.temperature_2m)}°`;
      $('.w-cond').textContent = words;
      $('.w-hl').textContent = `h ${Math.round(d.daily.temperature_2m_max[0])}° l ${Math.round(d.daily.temperature_2m_min[0])}°`;
      $('.w-wicon').textContent = icon;
      $('.w-clock').classList.add('has-weather');
    } catch {}
  };
  sky();
  setInterval(sky, 15 * 60 * 1000);

  // the latest project: its picture, or the projects page's placeholder
  const latest = [...PROJECTS].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest) {
    $('.w-pic').innerHTML = latest.thumb ? `<img src="${esc(latest.thumb)}" alt="" loading="lazy">` : '<i></i>';
    $('.w-project .w-title').textContent = latest.title;
    $('.w-project time').dateTime = latest.date;
    $('.w-project time').textContent = latest.date.split('-').reverse().join('.');
  } else {
    $('.w-project').hidden = true;
  }

  // the music: the last track from Last.fm, playing or played, or the favourite artist
  const music = $('.w-music');
  const show = ({ title, artist, art = '', playing = false, link = '' }) => {
    music.classList.toggle('playing', playing);
    $('.w-music .w-label-text').textContent = playing ? 'now playing' : LASTFM.user ? 'last played' : 'favorite song';
    $('.w-music .w-title').textContent = title;
    $('.w-music .w-artist').textContent = artist;
    $('.w-art').innerHTML = art ? `<img src="${esc(art)}" alt="">` : '<span class="material-symbols-rounded" aria-hidden="true">music_note</span>';
    if (link) music.href = link;
  };
  show(FAVOURITE);
  if (LASTFM.user && LASTFM.key) {
    const listen = async () => {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LASTFM.user)}&api_key=${encodeURIComponent(LASTFM.key)}&format=json&limit=1`;
        const t = (await (await fetch(url)).json()).recenttracks.track[0];
        show({
          title: t.name,
          artist: t.artist['#text'],
          art: t.image?.[3]?.['#text'] || '',
          playing: t['@attr']?.nowplaying === 'true',
          link: `https://www.last.fm/user/${encodeURIComponent(LASTFM.user)}`,
        });
      } catch {}
    };
    listen();
    setInterval(listen, 30 * 1000);
  }
}
