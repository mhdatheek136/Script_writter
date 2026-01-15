import React, { useState, useEffect, useRef } from 'react';
import SlideBlock from './SlideBlock';

const StudioEditor = ({
  data,
  setData,
  isDarkMode,
  onExit,

  addToast,
  narrationStyle
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState(data.slides || []);
  const [downloading, setDownloading] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const scrollRef = useRef(null);

  // Sync internal state with props if data changes externally
  useEffect(() => {
    setSlides(data.slides || []);
  }, [data.slides]);

  // Scroll active slide into view in the top bar
  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.children[currentIndex];
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const currentSlide = slides[currentIndex];

  const handleUpdateSlide = (newNarration) => {
    const updatedSlides = [...slides];
    updatedSlides[currentIndex] = {
      ...updatedSlides[currentIndex],
      narration_paragraph: newNarration
    };
    setSlides(updatedSlides);
    setData({ ...data, slides: updatedSlides });
  };

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

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-ui-bg-light dark:bg-ui-bg-dark animate-in fade-in duration-300 overflow-hidden font-ans text-slate-800 dark:text-slate-300">

      {/* TOP HEADER: Navigation & Actions */}
      <div className={`shrink-0 flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:px-6 border-b border-soft-border dark:border-slate-800 ${isDarkMode ? 'bg-ui-surface-dark/90' : 'bg-white/90'} backdrop-blur-md z-50`}>

        {/* Left: Exit & Branding */}
        <div className="flex items-center justify-between w-full md:w-auto md:justify-start gap-4 md:min-w-[200px]">
          <button
            onClick={onExit}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white"
            title="Exit Studio"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Studio Editor</span>
        </div>

        {/* Center: Slide Filmstrip */}
        <div className="w-full md:flex-1 md:max-w-3xl overflow-hidden relative group order-last md:order-none mt-2 md:mt-0">
          <div
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
          >
            {slides.map((slide, idx) => (
              <button
                key={slide.slide_number}
                onClick={() => setCurrentIndex(idx)}
                className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl border transition-all relative ${idx === currentIndex
                  ? isDarkMode
                    ? 'bg-soft-teal text-black border-soft-teal shadow-[0_0_15px_rgba(45,212,191,0.3)] scale-110 z-10'
                    : 'bg-soft-navy text-white border-soft-navy shadow-lg scale-110 z-10'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
              >
                <span className="text-[0.65rem] font-black">{slide.slide_number}</span>
                {idx === currentIndex && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-current" />
                )}
              </button>
            ))}
          </div>
          {/* Fade edges for scroll indication */}
          <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-ui-surface-dark to-transparent pointer-events-none ${isDarkMode ? 'from-[#1e1e1e]' : ''}`} />
          <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-ui-surface-dark to-transparent pointer-events-none ${isDarkMode ? 'from-[#1e1e1e]' : ''}`} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 md:min-w-[200px] justify-end">
          <button
            onClick={handleCopyAll}
            className="px-4 py-2.5 rounded-xl border border-soft-border dark:border-slate-700 font-bold text-[0.6rem] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncated"
          >
            Copy All
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              className={`px-6 py-2.5 rounded-xl font-bold text-[0.6rem] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 ${isDarkMode ? 'bg-soft-teal text-black' : 'bg-soft-navy text-white'}`}
            >
              Export
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {showExportOptions && (
              <div className={`absolute top-full right-0 mt-2 w-48 p-2 rounded-2xl shadow-2xl border z-[3000] animate-soft-in ${isDarkMode ? 'bg-ui-surface-dark border-slate-800' : 'bg-white border-slate-100'}`}>
                {['pptx', 'docx', 'txt'].map(opt => (
                  <button key={opt} onClick={() => handleDownload(opt)} className="flex items-center gap-3 w-full p-3 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-black/40 transition-colors text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    <div className="w-6 h-6 rounded border flex items-center justify-center text-[0.5rem] font-black">{opt}</div>
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA: Resizable Split Pane Area (controlled by SlideBlock) */}
      <div className="flex-1 w-full relative overflow-hidden bg-ui-bg-light dark:bg-black/20">
        {currentSlide && (
          <SlideBlock
            slide={currentSlide}
            tone={data.tone}
            narrationStyle={narrationStyle}
            isDarkMode={isDarkMode}
            onUpdate={handleUpdateSlide}
            addToast={addToast}
            isStudioLayout={true} // Hint to SlideBlock to use split layout
          />
        )}
      </div>

    </div>
  );
};

export default StudioEditor;
