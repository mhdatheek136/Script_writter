import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ResultsList from './components/ResultsList';
import CustomModal from './components/CustomModal';

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
        <div className={`fixed bottom-8 right-8 z-[3000] px-6 py-4 rounded-2xl shadow-2xl animate-soft-in border flex items-center gap-3 ${type === 'error' ? 'bg-rose-500 text-white border-rose-600' : 'bg-soft-teal text-black border-soft-teal'
            }`}>
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">{message}</span>
            <button onClick={onClose} className="opacity-60 hover:opacity-100">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
        </div>
    );
};

function App() {
    const [currentResults, setCurrentResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isStudioMode, setIsStudioMode] = useState(false);
    const [toasts, setToasts] = useState([]);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem(THEME_KEY) === 'dark';
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        return parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '320');
    });
    const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { setCurrentResults(JSON.parse(saved)); } catch (e) { localStorage.removeItem(STORAGE_KEY); }
        }
    }, []);

    useEffect(() => {
        if (currentResults) localStorage.setItem(STORAGE_KEY, JSON.stringify(currentResults));
    }, [currentResults]);

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
    };

    const performReset = () => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentResults(null);
        setError(null);
        setShowResetModal(false);
        setIsStudioMode(false);
        addToast('Settings cleared', 'success');
    };

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
                            isCollapsed={isSidebarCollapsed}
                            setCollapsed={setIsSidebarCollapsed}
                            onReset={() => currentResults ? setShowResetModal(true) : performReset()}
                            isLoading={isLoading}
                            setIsLoading={setIsLoading}
                            onProcessComplete={handleProcessComplete}
                            setError={setError}
                            isDarkMode={isDarkMode}
                            toggleTheme={() => setIsDarkMode(!isDarkMode)}
                            addToast={addToast}
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
                        <header className={`flex items-center justify-between mb-16 px-8 py-4 rounded-3xl ${isDarkMode ? 'bg-ui-surface-dark/60' : 'bg-white/80'} backdrop-blur-2xl border border-soft-border dark:border-soft-border-dark shadow-sm`}>
                            <div className="flex items-center gap-5">
                                <button
                                    onClick={() => setIsSidebarOpenMobile(true)}
                                    className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    aria-label="Open Settings"
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-6 rounded-full ${isDarkMode ? 'bg-soft-teal shadow-[0_0_10px_rgba(45,212,191,0.3)]' : 'bg-soft-navy'}`} />
                                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white uppercase">Script Writer</h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-1.5 rounded-xl text-[0.6rem] font-bold uppercase tracking-widest border ${isDarkMode ? 'bg-soft-teal/5 text-soft-teal border-soft-teal/20' : 'bg-soft-navy/5 text-soft-navy border-soft-navy/20'}`}>
                                    Pro Performance
                                </span>
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

                    {isLoading && !isStudioMode && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-2xl z-[200] flex flex-col items-center justify-center animate-in fade-in duration-500">
                            <div className="relative w-16 h-16 mb-8">
                                <div className="absolute inset-0 border-4 border-slate-800/30 rounded-full" />
                                <div className="absolute inset-0 border-4 border-soft-teal rounded-full border-t-transparent animate-spin shadow-lg" />
                            </div>
                            <p className="font-bold text-[0.6rem] uppercase tracking-[0.4em] text-white">
                                Processing Presentation
                            </p>
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
        </div>
    );
}

export default App;
