import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ResultsList from './components/ResultsList';
import CustomModal from './components/CustomModal';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import ProjectDashboard from './components/ProjectDashboard';
import { isAuthenticated, isAdmin, getUser, logout as authLogout, authFetch } from './services/auth';

const STORAGE_KEY = 'slide_narration_results';
const THEME_KEY = 'ui_theme';
const SIDEBAR_WIDTH_KEY = 'sidebar_width';

// Simple Toast Component
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-8 right-8 z-[3000] px-6 py-4 rounded-2xl shadow-xl animate-soft-in border flex items-center gap-3 ${type === 'error'
            ? 'bg-ui-surface-dark border-rose-500/30 text-rose-400'
            : 'bg-ui-surface-dark border-soft-teal/30 text-soft-teal'
            }`}>
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">{message}</span>
            <button onClick={onClose} className="opacity-60 hover:opacity-100">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
        </div>
    );
};

// User Menu Component with Change Password
const UserMenu = ({ onLogout, onOpenAdmin, onChangePassword, onBackToProjects }) => {
    const [isOpen, setIsOpen] = useState(false);
    const user = getUser();
    const userIsAdmin = isAdmin();

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-slate-800"
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${userIsAdmin ? 'bg-amber-500/20 text-amber-500' : 'bg-soft-teal/20 text-soft-teal'}`}>
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-soft-dark border border-soft-border-dark z-[160] bg-ui-surface-dark overflow-hidden">
                        <div className="p-4 border-b border-soft-border-dark">
                            <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                            <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${userIsAdmin ? 'text-amber-500' : 'text-soft-teal'}`}>
                                {userIsAdmin ? 'Administrator' : 'User'}
                            </p>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={() => { setIsOpen(false); onBackToProjects(); }}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 hover:bg-slate-800/50 text-slate-300 transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                All Projects
                            </button>
                            {userIsAdmin && (
                                <button
                                    onClick={() => { setIsOpen(false); onOpenAdmin(); }}
                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 hover:bg-slate-800/50 text-slate-300 transition-colors"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                    Manage Users
                                </button>
                            )}
                            <button
                                onClick={() => { setIsOpen(false); onChangePassword(); }}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 hover:bg-slate-800/50 text-slate-300 transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Change Password
                            </button>
                            <div className="my-2 border-t border-soft-border-dark" />
                            <button
                                onClick={() => { setIsOpen(false); onLogout(); }}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 hover:bg-rose-500/10 text-rose-400 transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Change Password Modal Component
const ChangePasswordModal = ({ onClose, addToast }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            const response = await authFetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to change password');
            }

            addToast('Password changed successfully');
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-soft-in">
            <div className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-8 w-full max-w-md shadow-soft-dark">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-wide">Change Password</h3>
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
                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-rose-500 shrink-0">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            required
                            className="input-field"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="input-field"
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
                            disabled={loading}
                            className="flex-1 py-4 bg-soft-teal text-black rounded-2xl font-bold uppercase tracking-wide text-xs transition-all hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] disabled:opacity-50"
                        >
                            {loading ? 'Changing...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function App() {
    // Auth state
    const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentProject, setCurrentProject] = useState(null);
    const [currentResults, setCurrentResults] = useState(null);
    const [processingStatus, setProcessingStatus] = useState({ active: false, percentage: 0, message: '', sessionId: null });
    const [error, setError] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isStudioMode, setIsStudioMode] = useState(false);
    const [toasts, setToasts] = useState([]);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return saved !== 'light'; // Default to dark mode
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        return parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '320');
    });
    const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Load results when project changes
    useEffect(() => {
        if (currentProject?.id) {
            const projectKey = `${STORAGE_KEY}_${currentProject.id}`;
            const saved = localStorage.getItem(projectKey);
            if (saved) {
                try { setCurrentResults(JSON.parse(saved)); } catch (e) { localStorage.removeItem(projectKey); }
            } else {
                setCurrentResults(null);
            }
        }
    }, [currentProject?.id]);

    // Save results when they change
    useEffect(() => {
        if (currentProject?.id && currentResults) {
            const projectKey = `${STORAGE_KEY}_${currentProject.id}`;
            localStorage.setItem(projectKey, JSON.stringify(currentResults));
        }
    }, [currentResults, currentProject?.id]);

    useEffect(() => {
        localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    useEffect(() => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    }, [sidebarWidth]);

    const addToast = (message, type = 'success') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => setIsResizing(false), []);
    const resize = useCallback((e) => {
        if (isResizing) {
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 600) setSidebarWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const handleProcessComplete = (data) => {
        setCurrentResults(data);
        setError(null);
        addToast('Presentation processed successfully');
        setProcessingStatus({ active: false, percentage: 0, message: '', sessionId: null });
    };

    const performReset = () => {
        if (currentProject?.id) {
            localStorage.removeItem(`${STORAGE_KEY}_${currentProject.id}`);
        }
        setCurrentResults(null);
        setError(null);
        setShowResetModal(false);
        setIsStudioMode(false);
        addToast('Settings cleared', 'success');
    };

    const handleLogout = async () => {
        await authLogout();
        setIsLoggedIn(false);
        setCurrentResults(null);
        setCurrentProject(null);
        localStorage.removeItem('current_project_id');
        addToast('Signed out successfully');
    };

    const handleBackToProjects = () => {
        setCurrentProject(null);
        setCurrentResults(null);
        localStorage.removeItem('current_project_id');
    };

    // Load active project on startup
    useEffect(() => {
        const loadActiveProject = async () => {
            const lastProjectId = localStorage.getItem('current_project_id');
            if (lastProjectId) {
                try {
                    const response = await authFetch(`/api/projects/${lastProjectId}`);
                    if (response.ok) {
                        const project = await response.json();
                        setCurrentProject(project);
                    } else {
                        localStorage.removeItem('current_project_id');
                    }
                } catch (e) {
                    localStorage.removeItem('current_project_id');
                }
            }
        };

        if (isLoggedIn && !currentProject) {
            loadActiveProject();
        }
    }, [isLoggedIn]);

    // Save active project id
    useEffect(() => {
        if (currentProject?.id) {
            localStorage.setItem('current_project_id', currentProject.id);
        }
    }, [currentProject]);

    // Show login if not authenticated
    if (!isLoggedIn) {
        return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
    }

    // Show Project Dashboard if no project selected
    if (!currentProject) {
        return (
            <div className="min-h-screen bg-ui-bg-dark font-ans text-slate-300">
                {/* Top Bar */}
                <header className="fixed top-0 left-0 right-0 z-50 bg-ui-surface-dark/80 backdrop-blur-xl border-b border-soft-border-dark">
                    <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-6 rounded-full bg-soft-teal shadow-[0_0_12px_rgba(45,212,191,0.4)]" />
                            <h1 className="text-xl font-bold tracking-tight text-white uppercase">Script Writer</h1>
                        </div>
                        <UserMenu
                            onLogout={handleLogout}
                            onOpenAdmin={() => setShowAdminPanel(true)}
                            onChangePassword={() => setShowChangePassword(true)}
                            onBackToProjects={handleBackToProjects}
                        />
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="pt-20">
                    <ProjectDashboard
                        onSelectProject={setCurrentProject}
                        isDarkMode={isDarkMode}
                    />
                </div>

                {/* Toast Container */}
                <div className="fixed bottom-0 right-0 p-8 z-[3000] flex flex-col gap-4">
                    {toasts.map(toast => (
                        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
                    ))}
                </div>

                {/* Admin Panel */}
                {showAdminPanel && (
                    <AdminPanel onClose={() => setShowAdminPanel(false)} />
                )}

                {/* Change Password Modal */}
                {showChangePassword && (
                    <ChangePasswordModal
                        onClose={() => setShowChangePassword(false)}
                        addToast={addToast}
                    />
                )}
            </div>
        );
    }

    // Main App with Sidebar (when project is selected)
    return (
        <div className={`flex h-screen w-screen overflow-hidden ${isDarkMode ? 'bg-ui-bg-dark' : 'bg-ui-bg-light'} font-ans text-slate-800 dark:text-slate-300 transition-colors duration-500`}>

            {!isStudioMode && (
                <>
                    {isSidebarOpenMobile && (
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[90] md:hidden transition-all duration-300"
                            onClick={() => setIsSidebarOpenMobile(false)}
                        />
                    )}

                    <div
                        style={{ width: isSidebarCollapsed ? '72px' : `${sidebarWidth}px` }}
                        className={`relative flex-shrink-0 z-[100] transition-all duration-300 ease-in-out md:static fixed inset-y-0 left-0 ${isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                    >
                        <Sidebar
                            project={currentProject}
                            isCollapsed={isSidebarCollapsed}
                            setCollapsed={setIsSidebarCollapsed}
                            onReset={() => currentResults ? setShowResetModal(true) : performReset()}
                            processingStatus={processingStatus}
                            setProcessingStatus={setProcessingStatus}
                            onProcessComplete={handleProcessComplete}
                            setError={setError}
                            isDarkMode={isDarkMode}
                            toggleTheme={() => setIsDarkMode(!isDarkMode)}
                            addToast={addToast}
                            currentProjectId={currentProject?.id}
                        />

                        {!isSidebarCollapsed && (
                            <div
                                onMouseDown={startResizing}
                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-soft-teal/20 transition-colors active:bg-soft-teal/40"
                            />
                        )}
                    </div>
                </>
            )}

            <main className={`flex-1 overflow-y-auto relative bg-transparent ${isStudioMode ? '' : 'px-4 md:px-8'}`}>
                <div className={`${isStudioMode ? 'w-full h-full' : 'max-w-[1000px] mx-auto py-12'} min-h-full flex flex-col`}>

                    {!isStudioMode && (
                        <header className={`relative z-[200] flex items-center justify-between mb-16 px-8 py-4 rounded-3xl ${isDarkMode ? 'bg-ui-surface-dark/60' : 'bg-white/80'} backdrop-blur-2xl border border-soft-border dark:border-soft-border-dark shadow-sm`}>
                            <div className="flex items-center gap-5">
                                <button
                                    onClick={() => setIsSidebarOpenMobile(true)}
                                    className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    aria-label="Open Settings"
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                                </button>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleBackToProjects}
                                        className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-soft-teal transition-colors"
                                        title="Back to projects"
                                    >
                                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                                            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                                        </svg>
                                    </button>
                                    <div className={`w-2 h-6 rounded-full ${isDarkMode ? 'bg-soft-teal shadow-[0_0_10px_rgba(45,212,191,0.3)]' : 'bg-soft-navy'}`} />
                                    <div>
                                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white uppercase">{currentProject?.name || 'Script Writer'}</h1>
                                        {currentProject?.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{currentProject.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-1.5 rounded-xl text-[0.6rem] font-bold uppercase tracking-widest border ${isDarkMode ? 'bg-soft-teal/5 text-soft-teal border-soft-teal/20' : 'bg-soft-navy/5 text-soft-navy border-soft-navy/20'}`}>
                                    Pro Performance
                                </span>
                                <UserMenu
                                    onLogout={handleLogout}
                                    onOpenAdmin={() => setShowAdminPanel(true)}
                                    onChangePassword={() => setShowChangePassword(true)}
                                    onBackToProjects={handleBackToProjects}
                                />
                            </div>
                        </header>
                    )}

                    {error && !isStudioMode && (
                        <div className="mb-8 p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-rose-600 dark:text-rose-400 animate-soft-in">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none" className="shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
                        </div>
                    )}

                    {currentResults ? (
                        <ResultsList
                            data={currentResults}
                            setData={setCurrentResults}
                            isDarkMode={isDarkMode}
                            isStudioMode={isStudioMode}
                            setStudioMode={setIsStudioMode}
                            addToast={addToast}
                        />
                    ) : (
                        !isStudioMode && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center animate-soft-in">
                                <div className={`w-28 h-28 rounded-[2.5rem] ${isDarkMode ? 'bg-ui-surface-dark border-slate-800' : 'bg-white border-slate-100'} border flex items-center justify-center mb-12 shadow-2xl transition-all duration-700 hover:rotate-6`}>
                                    <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="2" fill="none" className="text-slate-300 dark:text-slate-700"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                </div>
                                <h2 className="text-4xl font-bold mb-6 tracking-tight dark:text-white leading-tight uppercase">Draft your scripts.<br /><span className="text-slate-400">Refine with AI.</span></h2>
                                <p className="text-slate-500 dark:text-slate-500 max-w-sm text-[0.85rem] leading-relaxed font-bold uppercase tracking-widest">
                                    Professional AI assistance for slide deck narrations. Minimalist, focused, efficient.
                                </p>
                            </div>
                        )
                    )}

                    {processingStatus.active && !isStudioMode && (
                        <div className="fixed inset-0 bg-white/90 dark:bg-black/80 backdrop-blur-2xl z-[200] flex flex-col items-center justify-center animate-in fade-in duration-500">
                            <div className="w-full max-w-md px-8">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                                    <span>Processing</span>
                                    <span>{processingStatus.percentage}%</span>
                                </div>
                                <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-8">
                                    <div
                                        className="h-full bg-soft-navy dark:bg-soft-teal transition-all duration-500 ease-out"
                                        style={{ width: `${processingStatus.percentage}%` }}
                                    />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{processingStatus.message || 'Analyzing presentation structure...'}</p>
                                    <p className="text-xs text-slate-500">Please do not close this window</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Toast Container */}
            <div className="fixed bottom-0 right-0 p-8 z-[3000] flex flex-col gap-4">
                {toasts.map(toast => (
                    <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>

            {showResetModal && (
                <CustomModal
                    onConfirm={performReset}
                    onCancel={() => setShowResetModal(false)}
                />
            )}

            {showAdminPanel && (
                <AdminPanel onClose={() => setShowAdminPanel(false)} />
            )}

            {showChangePassword && (
                <ChangePasswordModal
                    onClose={() => setShowChangePassword(false)}
                    addToast={addToast}
                />
            )}
        </div>
    );
}

export default App;
