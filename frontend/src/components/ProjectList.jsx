import React, { useState, useEffect } from 'react';
import { authFetch } from '../services/auth';

/**
 * Project list component for managing projects.
 */
export default function ProjectList({ onSelectProject, selectedProjectId }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/projects');
            if (!response.ok) throw new Error('Failed to fetch projects');
            const data = await response.json();
            setProjects(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;

        setCreating(true);
        try {
            const response = await authFetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName.trim() })
            });

            if (!response.ok) throw new Error('Failed to create project');

            const newProject = await response.json();
            setProjects([newProject, ...projects]);
            setNewProjectName('');
            setShowCreateForm(false);
            onSelectProject(newProject);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteProject = async (project, e) => {
        e.stopPropagation();
        if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;

        try {
            const response = await authFetch(`/api/projects/${project.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete project');

            setProjects(projects.filter(p => p.id !== project.id));
            if (selectedProjectId === project.id) {
                onSelectProject(null);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="project-list">
            <div className="project-list-header">
                <h3>Projects</h3>
                <button
                    className="new-project-btn"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    title="Create new project"
                >
                    {showCreateForm ? '×' : '+'}
                </button>
            </div>

            {error && <div className="project-error">{error}</div>}

            {showCreateForm && (
                <form onSubmit={handleCreateProject} className="create-project-form">
                    <input
                        type="text"
                        placeholder="Project name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" disabled={creating || !newProjectName.trim()}>
                        {creating ? '...' : 'Create'}
                    </button>
                </form>
            )}

            {loading ? (
                <div className="loading">Loading...</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">
                    <p>No projects yet</p>
                    <button onClick={() => setShowCreateForm(true)}>
                        Create your first project
                    </button>
                </div>
            ) : (
                <ul className="projects">
                    {projects.map((project) => (
                        <li
                            key={project.id}
                            className={`project-item ${selectedProjectId === project.id ? 'selected' : ''}`}
                            onClick={() => onSelectProject(project)}
                        >
                            <div className="project-info">
                                <span className="project-name">{project.name}</span>
                                <span className="project-meta">
                                    {project.outputs_count} version{project.outputs_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <button
                                className="delete-btn"
                                onClick={(e) => handleDeleteProject(project, e)}
                                title="Delete project"
                            >
                                🗑️
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <style>{`
        .project-list {
          padding: 16px;
        }

        .project-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .project-list-header h3 {
          color: #fff;
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .new-project-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(102, 126, 234, 0.2);
          border: 1px solid rgba(102, 126, 234, 0.3);
          color: #667eea;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .new-project-btn:hover {
          background: rgba(102, 126, 234, 0.3);
        }

        .project-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .create-project-form {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .create-project-form input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 14px;
        }

        .create-project-form button {
          background: #667eea;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }

        .create-project-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 20px;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 30px 20px;
        }

        .empty-state p {
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 16px 0;
        }

        .empty-state button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
        }

        .projects {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .project-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .project-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .project-item.selected {
          background: rgba(102, 126, 234, 0.15);
          border-color: rgba(102, 126, 234, 0.3);
        }

        .project-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .project-name {
          color: #fff;
          font-size: 14px;
          font-weight: 500;
        }

        .project-meta {
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
        }

        .delete-btn {
          background: none;
          border: none;
          opacity: 0;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          transition: opacity 0.2s ease;
        }

        .project-item:hover .delete-btn {
          opacity: 0.6;
        }

        .delete-btn:hover {
          opacity: 1 !important;
        }
      `}</style>
        </div>
    );
}
