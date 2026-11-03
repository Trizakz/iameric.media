// All projects in one list; the projects page (projects-page.js) reads it. Later a builder will write this file,
// the way badge-editor.html writes badges.js.
//
// One entry per project:
//   id          unique, lowercase, for the project's own page later
//   title       as shown under the card
//   date        'YYYY-MM-DD': the page sorts by it and shows it as DD.MM.YYYY
//   categories  one or more of the keys in CATEGORIES
//   thumb       a square image (path), optional: without one the card shows a placeholder
//
// For now these are placeholders: the projects from the old site, without their images (their day is not known
// yet, so each stands on the 1st).

// the filters, in the order of the chips, each with its Material Symbols icon
export const CATEGORIES = {
  photo: { label: 'Photo', icon: 'camera' },
  video: { label: 'Video', icon: 'videocam' },
  graphics: { label: 'Graphics', icon: 'palette' },
  web: { label: 'Web', icon: 'language' },
};

export const PROJECTS = [
  { id: 'cafe-loewe', title: "Website 'Café Löwe'", date: '2026-04-01', categories: ['web'] },
  { id: 'spring', title: 'spring.', date: '2026-04-01', categories: ['video'] },
  { id: 'motion-short', title: 'Motion Graphics Short', date: '2026-04-01', categories: ['video'] },
  { id: 'portfolio-icons', title: 'Portfolio Icons', date: '2026-03-01', categories: ['graphics'] },
  { id: 'nostalgia-edit', title: 'Nostalgia-Inspired Edit', date: '2026-03-01', categories: ['video'] },
  { id: 'sky-photographs', title: 'Sky Photographs', date: '2026-03-01', categories: ['photo'] },
  { id: 'playlist-covers', title: 'Spotify Playlist Covers', date: '2026-01-01', categories: ['graphics'] },
  { id: 'manga-music-video', title: 'Manga Music Video', date: '2025-05-01', categories: ['video'] },
  { id: 'hundrum-zufrieden', title: "Website 'Hundrum zufrieden'", date: '2025-04-01', categories: ['web'] },
  { id: 'schoenheitsboutique', title: "Website 'Ihre Schoenheitsboutique'", date: '2022-05-01', categories: ['web'] },
  { id: 'digital-business', title: 'University Project Digital Business', date: '2022-02-01', categories: ['video'] },
];
