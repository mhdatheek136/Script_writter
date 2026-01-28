import React, { useState } from 'react';

const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [creating, setCreating] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setCreating(true);
        try {
            await onCreate(name, desc);
            // Don't close here, wait for parent to handle?
            // Usually parent closes or redirects.
            // But let's assume parent might throw.
        } catch (err) {
            // Error handling typically in parent or passed down
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-soft-in">
            <div className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-8 w-full max-w-lg shadow-soft-dark">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wide">New Project</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
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
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="Brief description of your project..."
                            rows={3}
                            className="input-field resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 border border-soft-border-dark rounded-2xl font-bold uppercase tracking-wide text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={creating || !name.trim()}
                            className="flex-1 py-4 bg-soft-teal text-black rounded-2xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {creating ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;
