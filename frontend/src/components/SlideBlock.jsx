import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const SlideBlock = ({ slide, tone, narrationStyle, onUpdate, isDarkMode, addToast, isStudioLayout = false }) => {
  // AI editing
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [aiRequest, setAiRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual editing
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualDraft, setManualDraft] = useState(slide.narration_paragraph || '');

  // Split Pane State
  // Split Pane State
  const [leftWidthPct, setLeftWidthPct] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep manual draft in sync 
  useEffect(() => {
    setManualDraft(slide.narration_paragraph || '');
  }, [slide.narration_paragraph, slide.slide_number]);

  const canSubmitAi = useMemo(() => aiRequest.trim().length > 0, [aiRequest]);

  // Resizing Logic
  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e) => {
    if (isResizing && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = e.clientX - containerRect.left;
      const newPct = (newLeftWidth / containerRect.width) * 100;
      if (newPct > 20 && newPct < 80) setLeftWidthPct(newPct);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // Add an invisible overlay to prevent iframe stealing events if any
      const overlay = document.createElement('div');
      overlay.id = 'resize-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.zIndex = '9999';
      overlay.style.cursor = 'col-resize';
      document.body.appendChild(overlay);

    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const overlay = document.getElementById('resize-overlay');
      if (overlay) document.body.removeChild(overlay);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resize, stopResizing]);


  const handleAiRewrite = async () => {
    if (!aiRequest.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/refine-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_text: slide.narration_paragraph,
          instruction: aiRequest,
          slide_context: `Slide ${slide.slide_number}: ${slide.original_content}`,
          tone: tone,
          style: narrationStyle || 'Human-like'
        }),
      });
      if (!response.ok) throw new Error('Failed to refine');
      const data = await response.json();
      onUpdate(data.refined_text);
      setAiRequest('');
      setIsAiEditing(false);
      addToast('Narration updated with AI');
    } catch (err) {
      addToast('Failed to update narration', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSave = () => {
    onUpdate(manualDraft);
    setIsManualEditing(false);
    addToast('Changes saved');
  };

  const handleManualCancel = () => {
    setManualDraft(slide.narration_paragraph || '');
    setIsManualEditing(false);
  };

  const handleCopyNarration = () => {
    navigator.clipboard.writeText(slide.narration_paragraph || '');
    addToast('Narration copied');
  };

  // Render logic based on layout mode
  if (!isStudioLayout) {
    // Fallback for regular list view (if used anywhere else)
    return (
      <div className="flex flex-col lg:flex-row gap-8 w-full animate-soft-in">
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="p-8 rounded-[2rem] border h-full bg-white dark:bg-ui-surface-dark border-slate-100 dark:border-slate-800">
            <p className="text-center text-slate-400 font-bold">Please open Studio Editor for the best experience.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row w-full h-full absolute inset-0">

      {/* LEFT PANE: Content & Context */}
      <div
        style={{ width: isMobile ? '100%' : `${leftWidthPct}%` }}
        className="h-[40%] lg:h-full overflow-y-auto custom-scrollbar p-6 lg:p-12 relative flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-2xl mx-auto space-y-10 pb-20">
          {/* Image */}
          {slide.image_url ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-black/40">
              <img
                src={slide.image_url}
                alt={`Slide ${slide.slide_number}`}
                className="w-full h-auto object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.classList.add('p-8', 'text-center');
                  e.target.parentElement.innerText = 'Image not available';
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center bg-slate-50 dark:bg-slate-800/50">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">No Image Preview</span>
            </div>
          )}

          {/* Content Analysis */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[0.6rem] font-black uppercase text-slate-400 tracking-widest">Rewritten Content</span>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              {slide.rewritten_content || <span className="text-slate-400 italic">No content analysis available.</span>}
            </div>
          </section>

          {/* Speaker Notes */}
          {slide.speaker_notes && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[0.6rem] font-black uppercase text-slate-400 tracking-widest">Original Notes</span>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <p className="text-sm text-slate-500 italic opacity-80 whitespace-pre-wrap">{slide.speaker_notes}</p>
            </section>
          )}
        </div>
      </div>

      {/* DRAG HANDLE */}
      {/* DRAG HANDLE (Desktop only) */}
      <div
        onMouseDown={startResizing}
        className={`hidden lg:flex w-1 hover:w-1.5 cursor-col-resize z-50 items-center justify-center transition-all bg-slate-200 dark:bg-slate-800 hover:bg-soft-navy dark:hover:bg-soft-teal active:bg-soft-navy dark:active:bg-soft-teal relative group`}
      >
        <div className="absolute inset-y-0 -left-2 -right-2 z-10" /> {/* Larger grab area */}
        <div className="h-8 w-1 bg-slate-400 rounded-full group-hover:bg-white transition-colors" />
      </div>

      {/* RIGHT PANE: Editor */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-white dark:bg-ui-surface-dark/30 relative">
        <div className="min-h-full flex flex-col p-8 lg:p-12 max-w-3xl mx-auto">

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-6 rounded-full ${isDarkMode ? 'bg-soft-teal' : 'bg-soft-navy'}`} />
              <h2 className="text-lg font-bold uppercase tracking-tight text-slate-800 dark:text-white">Narration Script</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyNarration}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-soft-navy dark:hover:text-soft-teal transition-colors"
                title="Copy Narration"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              </button>
              {!isManualEditing && (
                <button
                  onClick={() => setIsManualEditing(true)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-soft-navy dark:hover:text-soft-teal transition-colors"
                  title="Edit Manually"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}
            </div>
          </div>

          <div className={`flex-1 rounded-3xl transition-all relative group ${isManualEditing
            ? 'bg-white dark:bg-ui-surface-dark shadow-xl ring-2 ring-soft-navy/10 dark:ring-soft-teal/10'
            : 'bg-slate-50 dark:bg-black/20 hover:bg-white dark:hover:bg-ui-surface-dark border p-8'
            } ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
          >
            {/* AI Overlay Input */}
            {isAiEditing && (
              <div className="absolute inset-x-0 -top-16 z-20 animate-soft-in">
                <div className={`rounded-2xl p-2 shadow-2xl flex gap-2 border ${isDarkMode ? 'bg-ui-surface-dark border-slate-700' : 'bg-white border-slate-200'}`}>
                  <input
                    autoFocus
                    type="text"
                    value={aiRequest}
                    onChange={(e) => setAiRequest(e.target.value)}
                    placeholder="How should AI change this? (e.g., 'Make it punchier')"
                    className="flex-1 bg-transparent px-4 py-2 outline-none text-sm dark:text-white"
                    disabled={isSubmitting}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiRewrite()}
                  />
                  <button
                    onClick={handleAiRewrite}
                    disabled={!canSubmitAi || isSubmitting}
                    className="px-4 py-2 rounded-xl bg-soft-navy dark:bg-soft-teal text-white dark:text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : 'Refine'}
                  </button>
                  <button onClick={() => setIsAiEditing(false)} className="px-3 text-slate-400 hover:text-slate-600"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                </div>
              </div>
            )}

            {isManualEditing ? (
              <div className="flex flex-col h-full min-h-[300px] lg:min-h-[400px]">
                <textarea
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  className="flex-1 w-full p-8 bg-transparent outline-none resize-none text-lg text-slate-700 dark:text-slate-200 leading-8 font-medium placeholder-slate-300"
                  placeholder="Type narration here..."
                />
                <div className="p-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={handleManualCancel} className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  <button onClick={handleManualSave} className="px-6 py-2 rounded-xl bg-soft-navy dark:bg-soft-teal text-white dark:text-black text-xs font-bold uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all">Save Changes</button>
                </div>
              </div>
            ) : (
              <div className="relative h-full">
                <p className="text-lg text-slate-700 dark:text-slate-300 leading-8 font-medium whitespace-pre-wrap">
                  {slide.narration_paragraph}
                </p>

                {/* Floating AI Action Button */}
                <button
                  onClick={() => setIsAiEditing(!isAiEditing)}
                  className={`absolute bottom-0 right-0 p-3 rounded-2xl shadow-lg border transition-all ${isSubmitting ? 'animate-pulse' : 'hover:scale-110 active:scale-95'} ${isDarkMode ? 'bg-ui-surface-dark border-slate-700 text-soft-teal' : 'bg-white border-slate-200 text-soft-navy'}`}
                  title="AI Edit"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10 10 10 0 01-10-10 10 10 0 0110-10z" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">
            <span>{slide.narration_paragraph ? slide.narration_paragraph.split(' ').length : 0} words</span>
            <span>approx {Math.ceil((slide.narration_paragraph ? slide.narration_paragraph.split(' ').length : 0) / 130)} min speaking time</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SlideBlock;
