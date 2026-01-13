import React, { useState } from 'react';
import SlideBlock from './SlideBlock';
import GlobalRefinement from './GlobalRefinement';

const ResultsList = ({ data, setData, isDarkMode, isStudioMode, setStudioMode, addToast }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);

    const slides = data.slides || [];
    const currentSlide = slides[currentIndex];

    const handleDownload = async (format) => {
        if (!data.session_id) return;
        setDownloading(true);
        setShowExportOptions(false);

        const formData = new FormData();
        formData.append('session_id', data.session_id);
        formData.append('base_name', data.base_name);
        formData.append('format_type', format);
        formData.append('slides_json', JSON.stringify(data.slides));

        try {
            const response = await fetch('/api/generate-output', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${data.base_name}_narration.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            addToast(`Downloaded .${format} successfully`);
        } catch (err) {
            addToast('Export failed', 'error');
        } finally { setDownloading(false); }
    };

    const handleCopyAll = () => {
        let script = slides.map(s => `[SLIDE ${s.slide_number}]\n\n${s.narration_paragraph}`).join('\n\n---\n\n');
        navigator.clipboard.writeText(script);
        addToast('Full script copied to clipboard');
    };

    const nextSlide = () => {
        if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
    };

    const prevSlide = () => {
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    };

    if (isStudioMode) {
        return (
            <div className="fixed inset-0 z-[2000] flex flex-col bg-ui-bg-light dark:bg-ui-bg-dark animate-in fade-in duration-500 overflow-hidden">
                <div className={`p-6 border-b border-soft-border dark:border-soft-border-dark flex items-center justify-between ${isDarkMode ? 'bg-ui-bg-dark' : 'bg-white'}`}>
                    <div className="flex items-center gap-8">
                        <button onClick={() => setStudioMode(false)} className="flex items-center gap-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all group">
                            <div className="p-2 rounded-xl border border-soft-border dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800">
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            </div>
                            <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">Exit Editor</span>
                        </button>
                        <div className="h-6 w-px bg-soft-border dark:bg-soft-border-dark" />
                        <div className="flex items-center gap-4">
                            <button onClick={prevSlide} disabled={currentIndex === 0} className={`p-3 rounded-xl border ${currentIndex === 0 ? 'opacity-10' : 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'} border-soft-border dark:border-slate-800`}>
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <div className="flex flex-col items-center min-w-[100px]">
                                <span className="text-[0.6rem] font-bold text-slate-400 uppercase mb-0.5 tracking-widest">Progressive</span>
                                <span className="text-sm font-black dark:text-white">{currentIndex + 1} / {slides.length}</span>
                            </div>
                            <button onClick={nextSlide} disabled={currentIndex === slides.length - 1} className={`p-3 rounded-xl border ${currentIndex === slides.length - 1 ? 'opacity-10' : 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'} border-soft-border dark:border-slate-800`}>
                                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none"><path d="M9 18l6-6-6-6" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={handleCopyAll} className={`px-6 py-3 rounded-xl text-[0.65rem] font-bold uppercase tracking-widest border border-soft-border dark:border-slate-800 transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>Copy Full Script</button>
                        <div className={`px-4 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-[0.3em] border ${isDarkMode ? 'bg-soft-teal/5 text-soft-teal border-soft-teal/20' : 'bg-soft-navy/5 text-soft-navy border-soft-navy/20'}`}>Studio Environment</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 lg:p-16 custom-scrollbar">
                    <div className="max-w-[1200px] mx-auto">
                        {currentSlide && (
                            <SlideBlock
                                slide={currentSlide}
                                tone={data.tone}
                                isDarkMode={isDarkMode}
                                addToast={addToast}
                                onUpdate={(newText) => {
                                    const updated = [...slides];
                                    updated[currentIndex].narration_paragraph = newText;
                                    setData({ ...data, slides: updated });
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-soft-border dark:border-soft-border-dark flex justify-center">
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIndex ? (isDarkMode ? 'bg-soft-teal w-8' : 'bg-soft-navy w-8') : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300'}`} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="results" className="pb-32 space-y-12 animate-soft-in">
            <GlobalRefinement
                slides={data.slides}
                tone={data.tone}
                isDarkMode={isDarkMode}
                onUpdate={(newSlides) => setData({ ...data, slides: newSlides })}
            />

            <div className={`py-8 border-b border-soft-border dark:border-soft-border-dark flex flex-col md:flex-row justify-between items-center gap-8`}>
                <div className="flex items-center gap-5">
                    <div className={`w-2 h-10 rounded-full ${isDarkMode ? 'bg-soft-teal' : 'bg-soft-navy'}`} />
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white uppercase tracking-tight">Generated Script</h2>
                        <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Initial draft ready</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => setStudioMode(true)} className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-soft-navy text-white font-bold text-[0.65rem] uppercase tracking-widest transition-all shadow-xl dark:bg-soft-teal dark:text-black hover:scale-105 active:scale-95`}>
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        Open Studio Editor
                    </button>

                    <div className="relative">
                        <button onClick={() => setShowExportOptions(!showExportOptions)} disabled={downloading} className={`px-8 py-5 rounded-2xl border border-soft-border dark:border-slate-800 font-bold text-[0.65rem] uppercase tracking-widest transition-all hover:bg-slate-50 dark:hover:bg-ui-surface-dark ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Export</button>

                        {showExportOptions && (
                            <div className={`absolute top-full right-0 mt-4 p-2 w-[220px] rounded-[2rem] shadow-2xl border z-[100] animate-soft-in ${isDarkMode ? 'bg-ui-surface-dark border-slate-800' : 'bg-white border-slate-100'}`}>
                                {['pptx', 'docx', 'txt'].map(opt => (
                                    <button key={opt} onClick={() => handleDownload(opt)} className="flex items-center gap-4 w-full p-4 text-left rounded-2xl hover:bg-slate-100 dark:hover:bg-black/40 transition-colors text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <span className="w-8 h-8 rounded-lg flex items-center justify-center border font-black uppercase text-[0.5rem]">{opt}</span>
                                        {opt.toUpperCase()} Document
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {slides.slice(0, 3).map((s, i) => (
                    <div key={i} className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-ui-surface-dark/40 border-slate-800' : 'bg-white border-slate-100'} opacity-60 group hover:opacity-100 transition-opacity cursor-pointer`} onClick={() => { setCurrentIndex(i); setStudioMode(true); }}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Slide {s.slide_number} preview</span>
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                        </div>
                        <p className="text-sm dark:text-slate-400 line-clamp-3 italic font-medium">{s.narration_paragraph}</p>
                    </div>
                ))}
                {slides.length > 3 && (
                    <div className="text-center py-6">
                        <button onClick={() => setStudioMode(true)} className="px-8 py-4 rounded-xl border border-soft-border dark:border-slate-800 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-soft-navy dark:hover:text-soft-teal transition-all">Launch Studio for all {slides.length} segments</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsList;
