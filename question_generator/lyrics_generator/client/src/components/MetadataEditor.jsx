import React, { useState, useEffect, useCallback } from 'react';
import './MetadataEditor.css';

export default function MetadataEditor({ song, setSong }) {
  const [projects, setProjects] = useState([]);
  const [customProject, setCustomProject] = useState('');
  const [projectMetadata, setProjectMetadata] = useState({});
  const [yearOverride, setYearOverride] = useState(false);
  const [formatOverride, setFormatOverride] = useState(false);

  // Load all projects with metadata
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        const projList = data.projects || [];
        setProjects(projList);
        
        // Build metadata lookup
        const metadata = {};
        projList.forEach(proj => {
          metadata[proj.name] = proj;
        });
        setProjectMetadata(metadata);
      })
      .catch(err => console.error('Error loading projects:', err));
  }, []);

  const handleRelease = useCallback((field, value) => {
    setSong(prev => ({
      ...prev,
      release: { ...prev.release, [field]: value }
    }));
  }, [setSong]);

  // Handle project selection with auto-population
  const handleProjectChange = useCallback((projectName) => {
    if (projectName === '__custom__') {
      setCustomProject('');
      return;
    }

    const project = projectMetadata[projectName];
    
    // Always set project
    handleRelease('project', projectName);
    setCustomProject('');

    // Auto-populate year if not overridden
    if (project && !yearOverride) {
      handleRelease('year', project.year || new Date().getFullYear());
    }

    // Auto-populate formats if not overridden
    if (project && !formatOverride) {
      handleRelease('formats', project.formats || ['album']);
    }
  }, [projectMetadata, yearOverride, formatOverride, handleRelease]);

  const handleCustomProjectChange = useCallback((value) => {
    setCustomProject(value);
    handleRelease('project', value);
  }, [handleRelease]);

  const handleYearChange = useCallback((value) => {
    setYearOverride(value !== projectMetadata[song.release?.project]?.year);
    handleRelease('year', value);
  }, [song.release?.project, projectMetadata, handleRelease]);

  const handleFormatChange = useCallback((fmt) => {
    const formats = new Set(song.release?.formats || []);
    fmt.checked ? formats.add(fmt.name) : formats.delete(fmt.name);
    const newFormats = Array.from(formats);
    
    // Check if this is different from project default
    const projectFormats = projectMetadata[song.release?.project]?.formats || ['album'];
    setFormatOverride(JSON.stringify(newFormats.sort()) !== JSON.stringify(projectFormats.sort()));
    
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
        <label>Artists</label>
        <input
          value={Array.isArray(song.artists) ? song.artists.join(', ') : (song.artist || '')}
          onChange={(e) => {
            const raw = e.target.value;
            const artists = raw
              .split(',')
              .map(a => a.trim())
              .filter(a => a.length > 0);
            setSong(prev => ({
              ...prev,
              artists,
              artist: artists[0] || prev.artist
            }));
          }}
          placeholder="Kanye West, Kid Cudi"
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
          {projects.map(proj => (
            <option key={proj.name} value={proj.name}>{proj.name}</option>
          ))}
          <option value="__custom__">Create new...</option>
        </select>
        {song.release?.project === '__custom__' || (customProject && !projects.find(p => p.name === customProject)) ? (
          <input
            type="text"
            placeholder="New project name"
            value={customProject || song.release?.project || ''}
            onChange={(e) => handleCustomProjectChange(e.target.value)}
          />
        ) : null}
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
