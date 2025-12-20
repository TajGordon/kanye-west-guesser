const fs = require('fs');
const path = require('path');

// Migrates song JSON files from { artist: string } to { artists: string[] }
// Keeps legacy `artist` as the primary artist for compatibility.

const LYRICS_DIR = path.join(__dirname, 'lyrics');

const CURRENT_SCHEMA_VERSION = 2;

function normalizeSongArtists(data) {
  if (!data || typeof data !== 'object') return data;

  // Skip legacy schema files (e.g. { song_name, lines: [...] })
  const looksLikeLyricsEditorSong =
    typeof data.title === 'string' ||
    Array.isArray(data.lyrics) ||
    typeof data.artist === 'string' ||
    Array.isArray(data.artists);
  if (!looksLikeLyricsEditorSong) return data;

  const current = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;
  const legacyArtistsList = Array.isArray(data.artists) ? data.artists : [];
  const primary = (typeof data.artist === 'string' && data.artist.trim())
    ? data.artist.trim()
    : (legacyArtistsList[0] ? String(legacyArtistsList[0]).trim() : 'Kanye West');

  // Versioned migration: schemaVersion 2 introduces features (performers)
  // and redefines artists as publisher/primary.
  if (current < CURRENT_SCHEMA_VERSION) {
    if (!Array.isArray(data.features)) {
      data.features = legacyArtistsList
        .map(a => String(a).trim())
        .filter(Boolean)
        .filter(a => a.toLowerCase() !== primary.toLowerCase());
    }
    data.artists = [primary];
    data.artist = primary;
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  let artists = Array.isArray(data.artists) ? data.artists : null;
  if (!artists || artists.length === 0) {
    artists = [primary || 'Kanye West'];
  }

  const seen = new Set();
  data.artists = artists
    .map(a => String(a).trim())
    .filter(a => a.length > 0)
    .filter(a => {
      const key = a.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  data.artist = data.artists[0] || 'Kanye West';

  const featureInput = Array.isArray(data.features)
    ? data.features
    : (typeof data.features === 'string' ? [data.features] : []);
  const fSeen = new Set();
  data.features = featureInput
    .flatMap(v => String(v).split(','))
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .filter(v => v.toLowerCase() !== data.artist.toLowerCase())
    .filter(v => {
      const key = v.toLowerCase();
      if (fSeen.has(key)) return false;
      fSeen.add(key);
      return true;
    });

  if (!Number.isInteger(data.schemaVersion)) {
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  return data;
}

function normalizeLineVoices(song) {
  if (!song || typeof song !== 'object') return song;
  if (!Array.isArray(song.lyrics)) return song;

  const publisher = Array.isArray(song.artists) ? song.artists : (song.artist ? [song.artist] : ['Kanye West']);
  const features = Array.isArray(song.features) ? song.features : [];
  const fallbackPerformers = [...publisher, ...features];

  song.lyrics = song.lyrics.map((line) => {
    if (!line || typeof line !== 'object') return line;
    const fromSection = Array.isArray(line?.section?.artists) ? line.section.artists : [];
    const preferred = fromSection.length > 0 ? fromSection : fallbackPerformers;

    let voices = Array.isArray(line.voices) ? line.voices : null;
    if (!voices || voices.length === 0) {
      if (line.voice && typeof line.voice === 'object' && line.voice.id) {
        voices = [line.voice];
      } else {
        voices = preferred.map((name) => ({
          id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          display: String(name)
        }));
      }
    }

    const primaryVoice = voices[0] || line.voice;
    return { ...line, voices, voice: primaryVoice };
  });

  return song;
}

function normalizeSongProducers(song) {
  if (!song || typeof song !== 'object') return song;
  if (song.producers === undefined) return song;

  const input = Array.isArray(song.producers)
    ? song.producers
    : (typeof song.producers === 'string' ? [song.producers] : []);

  const seen = new Set();
  song.producers = input
    .flatMap(p => String(p).split(','))
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .filter(p => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return song;
}

function main() {
  const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
  let changed = 0;

  for (const file of files) {
    const full = path.join(LYRICS_DIR, file);
    const raw = fs.readFileSync(full, 'utf-8');
    const data = JSON.parse(raw);

    const beforeArtists = Array.isArray(data.artists) ? data.artists.slice() : null;
    const beforeArtist = data.artist;

    normalizeSongArtists(data);
    normalizeLineVoices(data);
    normalizeSongProducers(data);

    const afterArtists = data.artists;
    const afterArtist = data.artist;

    const same =
      JSON.stringify(beforeArtists) === JSON.stringify(afterArtists) &&
      beforeArtist === afterArtist;

    // Any change to the file should trigger a write.
    const changedLyrics = raw !== JSON.stringify(data, null, 2);
    if (!same || changedLyrics) {
      const backup = `${full}.bak-artists`;
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, raw);
      fs.writeFileSync(full, JSON.stringify(data, null, 2));
      changed++;
      console.log(`Updated ${file} (backup: ${path.basename(backup)})`);
    }
  }

  console.log(`Done. Updated ${changed}/${files.length} files.`);
}

main();
