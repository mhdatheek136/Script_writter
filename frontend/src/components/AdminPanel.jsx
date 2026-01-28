import React, { useState, useEffect } from 'react';
import { authFetch } from '../services/auth';

/**
 * Admin Panel for user management - matches Script Writer's industrial minimalist theme.
 */
export default function AdminPanel({ onClose }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await authFetch('/api/admin/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const response = await authFetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to create user');
            }
            await fetchUsers();
            setNewUser({ email: '', password: '', role: 'user' });
            setShowCreateForm(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const toggleUserStatus = async (user) => {
        try {
            const response = await authFetch(`/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !user.is_active })
            });
            if (!response.ok) throw new Error('Failed to update user');
            await fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteUser = async (user) => {
        if (!window.confirm(`Delete user "${user.email}"? This action cannot be undone.`)) return;
        try {
            const response = await authFetch(`/api/admin/users/${user.id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete user');
            await fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-soft-in">
            <div className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-soft-dark flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-soft-border-dark flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wide">User Management</h2>
                        <p className="text-xs text-slate-500 mt-1">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-soft-teal text-black rounded-xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_20px_rgba(45,212,191,0.3)]"
                        >
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add User
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-rose-500 shrink-0">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex-1">{error}</span>
                        <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-300">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Create Form */}
                {showCreateForm && (
                    <div className="mx-6 mt-4 p-5 bg-slate-900/50 border border-soft-border-dark rounded-2xl">
                        <form onSubmit={handleCreateUser} className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px] space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="user@example.com"
                                    required
                                    className="input-field"
                                />
                            </div>
                            <div className="flex-1 min-w-[200px] space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Minimum 8 characters"
                                    required
                                    className="input-field"
                                />
                            </div>
                            <div className="w-32 space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={creating}
                                className="px-6 py-3 bg-soft-teal text-black rounded-xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create User'}
                            </button>
                        </form>
                    </div>
                )}

                {/* User List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-slate-800/30 rounded-2xl p-4 animate-pulse">
                                    <div className="h-5 bg-slate-700 rounded w-1/3 mb-2" />
                                    <div className="h-4 bg-slate-700/50 rounded w-1/4" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className={`group bg-slate-900/30 border rounded-2xl p-4 flex items-center gap-4 transition-all ${user.is_active ? 'border-soft-border-dark hover:border-soft-teal/30' : 'border-rose-500/20 opacity-60'
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${user.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-soft-teal/20 text-soft-teal'
                                        }`}>
                                        {user.email[0].toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{user.email}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[0.65rem] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'text-amber-500' : 'text-slate-500'
                                                }`}>
                                                {user.role}
                                            </span>
                                            <span className={`text-[0.65rem] font-bold uppercase tracking-wider ${user.is_active ? 'text-green-400' : 'text-rose-400'
                                                }`}>
                                                {user.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => toggleUserStatus(user)}
                                            className={`p-2 rounded-lg transition-colors ${user.is_active
                                                    ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400'
                                                    : 'hover:bg-green-500/10 text-slate-500 hover:text-green-400'
                                                }`}
                                            title={user.is_active ? 'Disable user' : 'Enable user'}
                                        >
                                            {user.is_active ? (
                                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => deleteUser(user)}
                                            className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                                            title="Delete user"
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {users.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 text-sm">No users found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
