import React, { useState, useEffect } from 'react';
import { authFetch } from '../services/auth';

/**
 * Project Dashboard - Shows all projects in a grid layout.
 * Allows users to create, select, and manage projects.
 */
export default function ProjectDashboard({ onSelectProject, isDarkMode }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
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
                body: JSON.stringify({
                    name: newProjectName.trim(),
                    description: newProjectDesc.trim() || null
                })
            });

            if (!response.ok) throw new Error('Failed to create project');

            const newProject = await response.json();
            setProjects([newProject, ...projects]);
            setNewProjectName('');
            setNewProjectDesc('');
            setShowCreateModal(false);
            onSelectProject(newProject);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteProject = async (project, e) => {
        e.stopPropagation();
        if (!window.confirm(`Delete "${project.name}"? This will remove all files and cannot be undone.`)) return;

        try {
            const response = await authFetch(`/api/projects/${project.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete project');
            setProjects(projects.filter(p => p.id !== project.id));
        } catch (err) {
            setError(err.message);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    return (
        <div className="min-h-full p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-12">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Your Projects</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {projects.length} project{projects.length !== 1 ? 's' : ''} • Select one to continue
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-soft-teal text-black rounded-2xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] active:scale-[0.98]"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Project
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="max-w-6xl mx-auto mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-soft-in">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-rose-500 shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-300">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-6 animate-pulse">
                                <div className="h-6 bg-slate-800 rounded-xl w-2/3 mb-4" />
                                <div className="h-4 bg-slate-800 rounded-lg w-1/2" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : projects.length === 0 ? (
                /* Empty State */
                <div className="max-w-md mx-auto text-center py-20 animate-soft-in">
                    <div className="w-24 h-24 rounded-[2rem] bg-ui-surface-dark border border-soft-border-dark flex items-center justify-center mx-auto mb-8 shadow-soft-dark">
                        <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-slate-600">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-3">No Projects Yet</h3>
                    <p className="text-slate-500 text-sm mb-8">Create your first project to start generating professional narrations</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-8 py-4 bg-soft-teal text-black rounded-2xl font-bold uppercase tracking-wide text-sm transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.3)]"
                    >
                        Create First Project
                    </button>
                </div>
            ) : (
                /* Project Grid */
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => onSelectProject(project)}
                                className="group bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:border-soft-teal/30 hover:shadow-[0_0_40px_rgba(45,212,191,0.1)] animate-soft-in"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-soft-teal/10 border border-soft-teal/20 flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" className="text-soft-teal">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteProject(project, e)}
                                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"
                                        title="Delete project"
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-soft-teal transition-colors">
                                    {project.name}
                                </h3>

                                {project.description && (
                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-slate-600 uppercase tracking-wide">
                                    <span className="flex items-center gap-1.5">
                                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        {formatDate(project.created_at)}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        </svg>
                                        {project.outputs_count} version{project.outputs_count !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="mt-4 pt-4 border-t border-soft-border-dark">
                                    <span className="text-xs font-bold text-soft-teal uppercase tracking-wider group-hover:tracking-widest transition-all">
                                        Open Project →
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-soft-in">
                    <div className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-8 w-full max-w-lg shadow-soft-dark">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">New Project</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Name</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="e.g., Q4 Sales Presentation"
                                    required
                                    autoFocus
                                    className="input-field"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Description <span className="text-slate-600">(optional)</span>
                                </label>
                                <textarea
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                    placeholder="Brief description of your project..."
                                    rows={3}
                                    className="input-field resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-4 border border-soft-border-dark rounded-2xl font-bold uppercase tracking-wide text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating || !newProjectName.trim()}
                                    className="flex-1 py-4 bg-soft-teal text-black rounded-2xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
