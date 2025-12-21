import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MetadataEditor.css';

export default function MetadataEditor({ song, setSong }) {
  const [projects, setProjects] = useState([]);
  const [customProject, setCustomProject] = useState('');
  const [customEdition, setCustomEdition] = useState('');
  const [editionCreateMode, setEditionCreateMode] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState({});
  const [yearOverride, setYearOverride] = useState(false);
  const [formatOverride, setFormatOverride] = useState(false);

  // Keep raw comma-separated text while typing so we don't fight the cursor
  // by trimming/reformatting on every keystroke.
  const activeTextFieldRef = useRef(null);
  const [artistsText, setArtistsText] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [producersText, setProducersText] = useState('');

  const toCommaSeparated = useCallback((value) => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    return '';
  }, []);

  const parseCommaList = useCallback((raw) => {
    return String(raw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, []);

  // Sync raw text when a different song loads, but don't overwrite while the user is typing.
  useEffect(() => {
    if (!song) return;
    if (activeTextFieldRef.current !== 'artists') {
      setArtistsText(toCommaSeparated(Array.isArray(song.artists) ? song.artists : (song.artist || 'Kanye West')));
    }
    if (activeTextFieldRef.current !== 'features') {
      setFeaturesText(toCommaSeparated(song.features));
    }
    if (activeTextFieldRef.current !== 'producers') {
      setProducersText(toCommaSeparated(song.producers));
    }
  }, [song, toCommaSeparated]);

  const refreshProjects = useCallback(async () => {
    const r = await fetch('/api/projects');
    const data = await r.json();
    const projList = data.projects || [];
    setProjects(projList);
    const metadata = {};
    projList.forEach(proj => {
      metadata[proj.name] = proj;
    });
    setProjectMetadata(metadata);
  }, []);

  // Load all projects with metadata
  useEffect(() => {
    refreshProjects().catch(err => console.error('Error loading projects:', err));
  }, [refreshProjects]);

  const handleRelease = useCallback((field, value) => {
    setSong(prev => ({
      ...prev,
      release: { ...prev.release, [field]: value }
    }));
  }, [setSong]);

  // Ensure edition always has a value
  React.useEffect(() => {
    if (!song?.release) return;
    if (!song.release.edition) {
      handleRelease('edition', 'standard');
    }
  }, [song?.release?.edition, song?.release, handleRelease]);

  // Handle project selection with auto-population
  const handleProjectChange = useCallback((projectName) => {
    // Clearing selection: only clear project, don't stomp other fields.
    if (projectName === '') {
      setCustomProject('');
      handleRelease('project', '');
      return;
    }

    if (projectName === '__custom__') {
      // Enter "create new" mode
      setCustomProject('');
      handleRelease('project', '__custom__');
      return;
    }

    const project = projectMetadata[projectName];

    // Always set project
    handleRelease('project', projectName);
    setCustomProject('');

    // Selecting a known project should apply that project's defaults.
    // Overrides are opt-in: user can change values after selection.
    if (project) {
      setYearOverride(false);
      setFormatOverride(false);

      const year = project.year || new Date().getFullYear();
      const formats = project.formats || ['album'];
      const editions = Array.isArray(project.editions) && project.editions.length > 0 ? project.editions : ['standard'];
      const edition = editions[0] || 'standard';

      // Auto-populate publisher artists from the selected project.
      const projectArtists = Array.isArray(project.artists) && project.artists.length > 0
        ? project.artists
        : ['Kanye West'];

      setCustomEdition('');
      setEditionCreateMode(false);

      // Apply all project-derived defaults in one state update to avoid any batching/race issues.
      setSong(prev => ({
        ...prev,
        release: { ...prev.release, project: projectName, year, formats, edition },
        artists: projectArtists,
        artist: String(projectArtists[0] || prev.artist || 'Kanye West')
      }));
    }
  }, [projectMetadata, handleRelease, setSong]);

  const handleCustomProjectChange = useCallback((value) => {
    // Keep the user's in-progress name locally. Committing happens on Enter.
    setCustomProject(value);
  }, []);

  const persistProjectIfNeeded = useCallback(async (name) => {
    const projectName = String(name || '').trim();
    if (!projectName) return;

    // If it already exists, don't re-create; but still allow updating later.
    const exists = projects.some(p => p.name === projectName);
    if (!exists) {
      const payload = {
        year: song.release?.year || new Date().getFullYear(),
        formats: song.release?.formats || ['album'],
        artists: Array.isArray(song.artists) ? song.artists : (song.artist ? [song.artist] : ['Kanye West'])
      };

      const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to create project');
      }

      await refreshProjects();
      setYearOverride(false);
      setFormatOverride(false);
    }
  }, [projects, refreshProjects, song]);

  const commitCustomProjectIfNeeded = useCallback(async () => {
    const projectName = String(customProject || '').trim();
    if (!projectName) return;

    // Commit to the song only when the user is done typing.
    handleRelease('project', projectName);

    try {
      await persistProjectIfNeeded(projectName);
    } catch (err) {
      console.error(err);
    }
  }, [customProject, handleRelease, persistProjectIfNeeded]);

  const getEditionsForSelectedProject = useCallback(() => {
    const projectName = song.release?.project;
    const project = projectName ? projectMetadata[projectName] : null;
    const editions = Array.isArray(project?.editions) && project.editions.length > 0 ? project.editions : ['standard'];
    // Ensure standard is always present
    const seen = new Set();
    const merged = ['standard', ...editions]
      .map(e => String(e).trim())
      .filter(Boolean)
      .filter(e => {
        const k = e.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return merged;
  }, [projectMetadata, song.release?.project]);

  const persistEditionIfNeeded = useCallback(async (editionNameRaw) => {
    const editionName = String(editionNameRaw || '').trim();
    if (!editionName) return;
    const projectName = String(song.release?.project || '').trim();
    if (!projectName || projectName === '__custom__') return;

    const editions = getEditionsForSelectedProject();
    const exists = editions.some(e => e.toLowerCase() === editionName.toLowerCase());
    if (exists) return;

    const payload = {
      year: song.release?.year || new Date().getFullYear(),
      formats: song.release?.formats || ['album'],
      artists: Array.isArray(song.artists) ? song.artists : (song.artist ? [song.artist] : ['Kanye West']),
      editions: [...editions, editionName]
    };

    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to add edition');
    }

    await refreshProjects();
  }, [getEditionsForSelectedProject, refreshProjects, song]);

  const isCreateMode = useCallback(() => {
    const current = song.release?.project || '';
    if (current === '__custom__') return true;
    if (!current) return false;
    return !projects.some(p => p.name === current);
  }, [projects, song.release?.project]);

  const handleYearChange = useCallback((value) => {
    const project = projectMetadata[song.release?.project];
    if (!project) {
      setYearOverride(false);
    } else {
      setYearOverride(value !== project.year);
    }
    handleRelease('year', value);
  }, [song.release?.project, projectMetadata, handleRelease]);

  const handleFormatChange = useCallback((fmt) => {
    const formats = new Set(song.release?.formats || []);
    fmt.checked ? formats.add(fmt.name) : formats.delete(fmt.name);
    const newFormats = Array.from(formats);
    
    // Check if this is different from project default
    const project = projectMetadata[song.release?.project];
    if (!project) {
      setFormatOverride(false);
    } else {
      const projectFormats = project.formats || ['album'];
      setFormatOverride(JSON.stringify(newFormats.sort()) !== JSON.stringify(projectFormats.sort()));
    }
    
    handleRelease('formats', newFormats);
  }, [song.release, projectMetadata, handleRelease]);

  return (
    <div className="metadata-editor">
      <h3>Song Info</h3>
      <div className="field">
        <label>Title</label>
        <input
          value={song.title || ''}
          onChange={(e) => setSong(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>
      <div className="field">
        <label>Artists (publisher)</label>
        <input
          value={artistsText}
          onFocus={() => { activeTextFieldRef.current = 'artists'; }}
          onChange={(e) => {
            const raw = e.target.value;
            setArtistsText(raw);
            const artists = parseCommaList(raw);
            setSong(prev => ({
              ...prev,
              artists,
              artist: artists[0] || prev.artist || 'Kanye West'
            }));
          }}
          onBlur={() => {
            const artists = parseCommaList(artistsText);
            setSong(prev => ({
              ...prev,
              artists,
              artist: artists[0] || prev.artist || 'Kanye West'
            }));
            if (activeTextFieldRef.current === 'artists') activeTextFieldRef.current = null;
          }}
          placeholder="Kanye West"
        />
      </div>
      <div className="field">
        <label>Features (performers)</label>
        <input
          value={featuresText}
          onFocus={() => { activeTextFieldRef.current = 'features'; }}
          onChange={(e) => {
            const raw = e.target.value;
            setFeaturesText(raw);
            const features = parseCommaList(raw);
            setSong(prev => ({
              ...prev,
              features
            }));
          }}
          onBlur={() => {
            const features = parseCommaList(featuresText);
            setSong(prev => ({
              ...prev,
              features
            }));
            if (activeTextFieldRef.current === 'features') activeTextFieldRef.current = null;
          }}
          placeholder="Kid Cudi, Pusha T"
        />
      </div>
      <div className="field">
        <label>Producers (optional)</label>
        <input
          value={producersText}
          onFocus={() => { activeTextFieldRef.current = 'producers'; }}
          onChange={(e) => {
            const raw = e.target.value;
            setProducersText(raw);
            const producers = parseCommaList(raw);
            setSong(prev => ({
              ...prev,
              producers
            }));
          }}
          onBlur={() => {
            const producers = parseCommaList(producersText);
            setSong(prev => ({
              ...prev,
              producers
            }));
            if (activeTextFieldRef.current === 'producers') activeTextFieldRef.current = null;
          }}
          placeholder="Mike Dean, Kanye West"
        />
      </div>
      <h3>Release Info</h3>
      <div className="field">
        <label>Project</label>
        <select
          value={song.release?.project || ''}
          onChange={(e) => handleProjectChange(e.target.value)}
        >
          <option value="">Select or create...</option>
          {/* If user typed a new name, keep it visible/selectable */}
          {isCreateMode() && customProject && !projects.some(p => p.name === customProject) && (
            <option value={customProject}>{customProject} (new)</option>
          )}
          {projects.map(proj => (
            <option key={proj.name} value={proj.name}>{proj.name}</option>
          ))}
          <option value="__custom__">Create new...</option>
        </select>
        {isCreateMode() ? (
          <input
            type="text"
            placeholder="New project name"
            value={customProject}
            onChange={(e) => handleCustomProjectChange(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              await commitCustomProjectIfNeeded();
            }}
          />
        ) : null}
      </div>

      <div className="field">
        <label>Edition</label>
        <select
          value={song.release?.edition || 'standard'}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '__custom__') {
              setCustomEdition('');
              setEditionCreateMode(true);
              return;
            }
            setEditionCreateMode(false);
            setCustomEdition('');
            handleRelease('edition', value);
          }}
          disabled={!song.release?.project}
        >
          {customEdition && (
            <option value={customEdition}>{customEdition} (new)</option>
          )}
          {getEditionsForSelectedProject().map((ed) => (
            <option key={ed} value={ed}>{ed}</option>
          ))}
          <option value="__custom__">Create new...</option>
        </select>
        {/* Create new edition */}
        {song.release?.project && editionCreateMode && (
          <input
            type="text"
            placeholder="New edition name (e.g. deluxe)"
            value={customEdition}
            onChange={(e) => {
              setCustomEdition(e.target.value);
              if (e.target.value.trim()) {
                handleRelease('edition', e.target.value.trim());
              }
            }}
            onBlur={async () => {
              try {
                await persistEditionIfNeeded(customEdition);
              } catch (err) {
                console.error(err);
              }
            }}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              try {
                await persistEditionIfNeeded(customEdition);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}
      </div>

      <div className="field">
        <label>
          Year
          {projectMetadata[song.release?.project] && yearOverride && (
            <span className="override-indicator" title="Overridden from project default">
              (custom)
            </span>
          )}
        </label>
        <input
          type="number"
          value={song.release?.year || new Date().getFullYear()}
          onChange={(e) => handleYearChange(parseInt(e.target.value))}
        />
        {projectMetadata[song.release?.project] && (
          <small className="field-hint">
            Project default: {projectMetadata[song.release?.project].year}
          </small>
        )}
      </div>

      <div className="field">
        <label>Status</label>
        <select
          value={song.release?.status || 'official'}
          onChange={(e) => handleRelease('status', e.target.value)}
        >
          <option value="official">Official</option>
          <option value="leaked">Leaked</option>
          <option value="unofficial">Unofficial</option>
        </select>
      </div>

      <div className="field">
        <label>
          Formats
          {projectMetadata[song.release?.project] && formatOverride && (
            <span className="override-indicator" title="Overridden from project default">
              (custom)
            </span>
          )}
        </label>
        <div className="checkboxes">
          {['album', 'single', 'mixtape', 'ep'].map(fmt => (
            <label key={fmt}>
              <input
                type="checkbox"
                checked={(song.release?.formats || []).includes(fmt)}
                onChange={(e) => handleFormatChange({ name: fmt, checked: e.target.checked })}
              />
              {fmt}
            </label>
          ))}
        </div>
        {projectMetadata[song.release?.project] && (
          <small className="field-hint">
            Project default: {(projectMetadata[song.release?.project].formats || ['album']).join(', ')}
          </small>
        )}
      </div>
    </div>
  );
}
