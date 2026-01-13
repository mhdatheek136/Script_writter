import React, { useEffect, useMemo, useState } from 'react';

const SlideBlock = ({ slide, tone, onUpdate, isDarkMode, addToast }) => {
  // AI editing
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [aiRequest, setAiRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual editing
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualDraft, setManualDraft] = useState(slide.narration_paragraph || '');

  // Keep manual draft in sync when slide changes (or after an external update)
  useEffect(() => {
    setManualDraft(slide.narration_paragraph || '');
  }, [slide.narration_paragraph, slide.slide_number]);

  const canSubmitAi = useMemo(() => aiRequest.trim().length > 0, [aiRequest]);

  const handleAiRewrite = async () => {
    if (!canSubmitAi) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('slide_number', slide.slide_number);
    formData.append('current_narration', slide.narration_paragraph);
    formData.append('rewritten_content', slide.rewritten_content);
    formData.append('speaker_notes', slide.speaker_notes || '');
    formData.append('user_request', aiRequest);
    formData.append('tone', tone || 'Professional');

    try {
      const response = await fetch('/api/rewrite-narration', { method: 'POST', body: formData });
      const data = await response.json();

      if (data.success) {
        onUpdate(data.rewritten_narration);
        setAiRequest('');
        setIsAiEditing(false);
        addToast('Slide narration updated');
      } else {
        addToast('Rewrite failed', 'error');
      }
    } catch (err) {
      addToast('Error communicating with AI', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(slide.narration_paragraph);
    addToast('Narration copied to clipboard');
  };

  const handleManualSave = () => {
    const next = manualDraft ?? '';
    onUpdate(next);
    setIsManualEditing(false);
    addToast('Narration updated');
  };

  const handleManualCancel = () => {
    setManualDraft(slide.narration_paragraph || '');
    setIsManualEditing(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full animate-soft-in">
      {/* Left Panel: Content & Notes */}
      <div className="lg:w-1/3 flex flex-col gap-6">
        <div
          className={`p-8 rounded-[2rem] border h-full ${
            isDarkMode ? 'bg-ui-surface-dark border-slate-800' : 'bg-white border-slate-100 shadow-sm'
          }`}
        >
          <div className="space-y-10">
            <section>
              <div className="text-[0.6rem] font-bold uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-soft-teal rounded-full" />
                Raw Content
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                {slide.rewritten_content}
              </p>
            </section>

            <section>
              <div className="text-[0.6rem] font-bold uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                Speaker Notes
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-600 leading-relaxed italic opacity-80 font-medium whitespace-pre-wrap">
                {slide.speaker_notes || 'No notes available for this slide.'}
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Right Panel: Narration & Editing */}
      <div className="lg:w-2/3">
        <div
          className={`p-10 rounded-[2.5rem] border h-full flex flex-col ${
            isDarkMode ? 'bg-black/20 border-slate-800/40' : 'bg-slate-50/50 border-slate-100 shadow-inner'
          }`}
        >
          <div className="flex items-center justify-between mb-10 border-b border-soft-border dark:border-soft-border-dark pb-6">
            <div className="flex items-center gap-3">
              <div className={`w-1 h-4 rounded-full ${isDarkMode ? 'bg-soft-teal' : 'bg-soft-navy'}`} />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-200">
                Generated Narration
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="p-3 rounded-xl hover:bg-white dark:hover:bg-ui-surface-dark text-slate-400 transition-all border border-transparent hover:border-soft-border dark:hover:border-slate-800"
                aria-label="Copy narration"
                type="button"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              </button>

              {/* AI edit toggle */}
              <button
                onClick={() => setIsAiEditing((v) => !v)}
                className={`p-3 rounded-xl transition-all border ${
                  isAiEditing
                    ? isDarkMode
                      ? 'bg-soft-teal text-black border-soft-teal'
                      : 'bg-soft-navy text-white shadow-lg border-soft-navy'
                    : 'hover:bg-white dark:hover:bg-ui-surface-dark text-slate-400 border-transparent hover:border-soft-border dark:hover:border-slate-800'
                }`}
                aria-label="AI refine"
                type="button"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M12 3v3" />
                  <path d="M21 12h-3" />
                  <path d="M12 21v-3" />
                  <path d="M3 12h3" />
                  <path d="M18.364 5.636l-2.121 2.121" />
                  <path d="M7.757 16.243l-2.121 2.121" />
                  <path d="M18.364 18.364l-2.121-2.121" />
                  <path d="M7.757 7.757 5.636 5.636" />
                </svg>
              </button>

              {/* Manual edit toggle */}
              <button
                onClick={() => setIsManualEditing((v) => !v)}
                className={`p-3 rounded-xl transition-all border ${
                  isManualEditing
                    ? isDarkMode
                      ? 'bg-soft-teal text-black border-soft-teal'
                      : 'bg-soft-navy text-white shadow-lg border-soft-navy'
                    : 'hover:bg-white dark:hover:bg-ui-surface-dark text-slate-400 border-transparent hover:border-soft-border dark:hover:border-slate-800'
                }`}
                aria-label="Manual edit"
                type="button"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1">
            {/* AI editing part should be on top */}
            {isAiEditing && (
              <div className="mb-8 space-y-4 animate-soft-in">
                <div className="text-[0.6rem] font-bold uppercase text-slate-400 tracking-widest">
                  AI Refinement
                </div>

                <textarea
                  value={aiRequest}
                  onChange={(e) => setAiRequest(e.target.value)}
                  placeholder="Refinement instruction for this slide..."
                  className="w-full bg-white dark:bg-black/30 border border-soft-border dark:border-slate-800 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-soft-teal/5 transition-all outline-none resize-none min-h-[100px] shadow-inner font-medium dark:text-slate-200"
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsAiEditing(false)}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleAiRewrite}
                    disabled={isSubmitting || !canSubmitAi}
                    className={`px-8 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                      isDarkMode ? 'bg-soft-teal text-black' : 'bg-soft-navy text-white'
                    }`}
                    type="button"
                  >
                    {isSubmitting ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            )}

            {/* Manual editing below AI */}
            {isManualEditing && (
              <div className="mb-10 space-y-4 animate-soft-in">
                <div className="text-[0.6rem] font-bold uppercase text-slate-400 tracking-widest">
                  Manual Editing
                </div>

                <textarea
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  placeholder="Edit narration manually..."
                  className="w-full bg-white dark:bg-black/30 border border-soft-border dark:border-slate-800 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-soft-teal/5 transition-all outline-none resize-none min-h-[140px] shadow-inner font-medium dark:text-slate-200"
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleManualCancel}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleManualSave}
                    disabled={(manualDraft ?? '').trim().length === 0}
                    className={`px-8 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                      isDarkMode ? 'bg-soft-teal text-black' : 'bg-soft-navy text-white'
                    }`}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Narration display */}
            <div className="text-base md:text-lg leading-relaxed dark:text-slate-200 font-medium whitespace-pre-wrap">
              {slide.narration_paragraph}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideBlock;
