import React, { useMemo, useRef, useState } from 'react';

const Sidebar = ({
  isCollapsed,
  setCollapsed,
  onReset,
  isLoading,
  setIsLoading,
  onProcessComplete,
  setError,
  isDarkMode,
  toggleTheme,
  addToast,
}) => {
  const [formData, setFormData] = useState({
    tone: 'Conversational',
    audience_level: 'General',
    narration_style: 'Conversational',
    dynamic_length: true,
    min_words: 50,
    max_words_fixed: 150,
    use_contextual_notes: true,
    enable_ai_polishing: true,
    custom_instructions: '',
  });

  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleProcess = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      addToast('Please select a file first', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    const data = new FormData();
    data.append('file', file);
    Object.keys(formData).forEach((key) => data.append(key, formData[key]));

    try {
      const response = await fetch('/api/process', { method: 'POST', body: data });
      if (!response.ok) throw new Error(await response.text());
      onProcessComplete(await response.json());
    } catch (err) {
      setError(err.message);
      addToast('Processing failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const tooltips = useMemo(
    () => ({
      tone: 'The overall vibe of the narration (warm, confident, friendly, etc.).',
      narration_style: 'How the narration is structured (more story-like, concise, or conversational).',
      audience_level: 'How simple or technical the wording should be.',
      dynamic_length: 'When on, the AI picks the best length per slide automatically.',
      contextual: 'Uses your speaker notes to make the narration more accurate.',
      polishing: 'Adds a final pass to improve clarity and flow.',
      custom: 'Extra guidance you want the AI to follow for every slide.',
      file: 'Upload a .PPTX file to generate narration for each slide.',
    }),
    []
  );

  const baseInput =
    `w-full px-4 py-3 rounded-xl border transition-all text-xs font-bold font-sans outline-none ` +
    `${isDarkMode ? 'bg-ui-surface-dark border-slate-800 text-white focus:border-soft-teal' : 'bg-white border-slate-100 text-slate-700 focus:border-soft-navy shadow-sm'}`;

  const selectClasses =
    baseInput +
    ` appearance-none cursor-pointer pr-10 ` +
    `${isDarkMode ? 'hover:border-slate-700' : 'hover:border-slate-200'}`;

  const numberClasses = baseInput;

  /**
   * Tooltip constraints you asked for:
   * - Tooltip width should NEVER exceed the container width (the control width).
   * Implementation:
   * - Wrap label + icon in a "w-full" container
   * - Tooltip uses: left-0 right-0 (so it matches container width exactly)
   * - Uses max-w-full + w-full to guarantee it can't overflow wider than the control block
   */
  const LabelWithTooltip = ({ label, tooltipKey }) => (
    <div className="w-full">
      <div className="group relative w-full flex items-center justify-between mb-2 ml-1">
        <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider">{label}</label>

        <div className="cursor-help text-slate-500 opacity-50 hover:opacity-100 transition-opacity">
          <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" strokeWidth="3" fill="none">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>

        {/* Tooltip (same width as container/control) */}
        <div
          className="
            absolute z-[200] left-0 right-0 top-full mt-2
            w-full max-w-full
            rounded-xl bg-slate-900 text-white text-[0.65rem] font-medium leading-relaxed
            shadow-2xl border border-white/10
            opacity-0 translate-y-1 pointer-events-none
            group-hover:opacity-100 group-hover:translate-y-0
            transition-all duration-200
          "
        >
          <div className="p-3 break-words">{tooltips[tooltipKey]}</div>
          <div className="absolute right-4 -top-1.5 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-white/10" />
        </div>
      </div>
    </div>
  );

  return (
    <aside
      className={`h-full flex flex-col transition-all duration-500 overflow-visible relative ${
        isDarkMode ? 'bg-ui-bg-dark border-r border-soft-border-dark' : 'bg-slate-50 border-r border-soft-border'
      }`}
    >
      {/* Header Area with Theme Toggle */}
      <div className={`p-6 border-b ${isDarkMode ? 'border-soft-border-dark' : 'border-soft-border'}`}>
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onReset}
              className={`group flex items-center justify-center gap-3 flex-1 py-4 rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest px-4 ${
                isDarkMode
                  ? 'bg-ui-surface-dark hover:bg-slate-800/40 text-soft-teal'
                  : 'bg-white hover:bg-slate-50 border border-soft-border text-soft-navy shadow-sm'
              }`}
              type="button"
            >
              <svg
                className="transition-transform group-hover:rotate-90"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Project</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500 flex-shrink-0"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              {isDarkMode ? (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={onReset}
            className={`group flex items-center justify-center w-full py-4 rounded-2xl transition-all duration-300 font-bold text-xs uppercase tracking-widest ${
              isDarkMode
                ? 'bg-ui-surface-dark hover:bg-slate-800/40 text-soft-teal'
                : 'bg-white hover:bg-slate-50 border border-soft-border text-soft-navy shadow-sm'
            }`}
            type="button"
          >
            <svg
              className="transition-transform group-hover:rotate-90"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Configurations - Scrollable */}
      <div className={`flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-8 ${isCollapsed ? 'hidden' : 'block'}`}>
        {/* File Section */}
        <section>
          <LabelWithTooltip label="Presentation" tooltipKey="file" />
          <div className="relative group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => addToast(`File loaded: ${e.target.files?.[0]?.name}`)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept=".pptx"
            />
            <div
              className={`flex items-center gap-4 p-4 rounded-2xl border border-dashed transition-all ${
                isDarkMode
                  ? 'bg-black/20 border-slate-800 group-hover:border-soft-teal'
                  : 'bg-white border-slate-200 group-hover:border-soft-navy shadow-sm'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-slate-400 group-hover:scale-110 transition-transform"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xs font-bold text-slate-500 truncate">
                {fileInputRef.current?.files?.[0]?.name || 'Upload .PPTX'}
              </span>
            </div>
          </div>
        </section>

        {/* Global Settings */}
        <section className="space-y-6">
          <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Settings</label>

          {/* Tone */}
          <div className="relative">
            <LabelWithTooltip label="Tone" tooltipKey="tone" />
            <div className="relative">
              <select name="tone" value={formData.tone} onChange={handleInputChange} className={selectClasses}>
                {['Conversational', 'Friendly', 'Professional', 'Bold', 'Academic', 'Persuasive'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Style */}
          <div className="relative">
            <LabelWithTooltip label="Style" tooltipKey="narration_style" />
            <div className="relative">
              <select name="narration_style" value={formData.narration_style} onChange={handleInputChange} className={selectClasses}>
                {['Conversational', 'Human-like', 'Professional', 'Formal', 'Concise', 'Storytelling'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Audience */}
          <div className="relative">
            <LabelWithTooltip label="Audience" tooltipKey="audience_level" />
            <div className="relative">
              <select name="audience_level" value={formData.audience_level} onChange={handleInputChange} className={selectClasses}>
                {['General', 'Executive', 'Technical', 'Junior', 'Expert'].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Length */}
          <div className="pt-2 relative">
            <LabelWithTooltip label="Length" tooltipKey="dynamic_length" />
            <div className={`p-1 rounded-xl flex gap-1 ${isDarkMode ? 'bg-black/40' : 'bg-slate-200/50 shadow-inner'}`}>
              <button
                onClick={() => setFormData({ ...formData, dynamic_length: true })}
                className={`flex-1 py-2 rounded-lg text-[0.6rem] font-bold uppercase transition-all ${
                  formData.dynamic_length
                    ? isDarkMode
                      ? 'bg-soft-teal text-black'
                      : 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500'
                }`}
                type="button"
              >
                Dynamic
              </button>
              <button
                onClick={() => setFormData({ ...formData, dynamic_length: false })}
                className={`flex-1 py-2 rounded-lg text-[0.6rem] font-bold uppercase transition-all ${
                  !formData.dynamic_length
                    ? isDarkMode
                      ? 'bg-soft-teal text-black'
                      : 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500'
                }`}
                type="button"
              >
                Fixed
              </button>
            </div>
          </div>

          {!formData.dynamic_length && (
            <div className="grid grid-cols-2 gap-4 animate-soft-in">
              <div>
                <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Min Words</label>
                <input type="number" name="min_words" value={formData.min_words} onChange={handleInputChange} className={numberClasses} />
              </div>
              <div>
                <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Max Words</label>
                <input
                  type="number"
                  name="max_words_fixed"
                  value={formData.max_words_fixed}
                  onChange={handleInputChange}
                  className={numberClasses}
                />
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center group cursor-pointer relative">
              <input type="checkbox" name="use_contextual_notes" checked={formData.use_contextual_notes} onChange={handleInputChange} className="hidden" />
              <div className={`w-10 h-6 rounded-full relative transition-all ${formData.use_contextual_notes ? 'bg-soft-teal' : 'bg-slate-300 dark:bg-slate-800'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${formData.use_contextual_notes ? 'translate-x-4' : ''}`} />
              </div>
              <div className="ml-3 w-full">
                <LabelWithTooltip label="Contextual Notes" tooltipKey="contextual" />
              </div>
            </label>

            <label className="flex items-center group cursor-pointer relative">
              <input type="checkbox" name="enable_ai_polishing" checked={formData.enable_ai_polishing} onChange={handleInputChange} className="hidden" />
              <div className={`w-10 h-6 rounded-full relative transition-all ${formData.enable_ai_polishing ? 'bg-soft-teal' : 'bg-slate-300 dark:bg-slate-800'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${formData.enable_ai_polishing ? 'translate-x-4' : ''}`} />
              </div>
              <div className="ml-3 w-full">
                <LabelWithTooltip label="AI Polishing" tooltipKey="polishing" />
              </div>
            </label>
          </div>

          {/* Custom instructions */}
          <div className="pt-4">
            <LabelWithTooltip label="Custom Instructions" tooltipKey="custom" />
            <textarea
              name="custom_instructions"
              value={formData.custom_instructions}
              onChange={handleInputChange}
              placeholder="e.g., keep it simple, add a quick hook, avoid buzzwords…"
              className={`${baseInput} h-24 resize-none leading-relaxed p-4`}
            />
          </div>
        </section>
      </div>

      {/* STICKY Generate Button at Bottom */}
      <div
        className={`p-6 border-t ${
          isDarkMode ? 'border-soft-border-dark bg-ui-bg-dark/80' : 'border-soft-border bg-slate-50/80'
        } backdrop-blur-md ${isCollapsed ? 'hidden' : 'block'}`}
      >
        <button
          onClick={handleProcess}
          disabled={isLoading}
          className={`w-full py-5 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
            isDarkMode ? 'bg-soft-teal text-black hover:scale-[1.02]' : 'bg-soft-navy text-white hover:scale-[1.02]'
          }`}
          type="button"
        >
          {isLoading ? 'Processing...' : 'Generate Script'}
        </button>
      </div>

      {/* Theme Toggle Button - Separate when sidebar is collapsed */}
      {isCollapsed && (
        <div className="p-6 flex items-center justify-center border-t border-soft-border dark:border-soft-border-dark">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500 flex-shrink-0"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            type="button"
          >
            {isDarkMode ? (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Sidebar Collapse Button */}
      <button
        onClick={() => setCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white dark:bg-ui-surface-dark border border-soft-border dark:border-soft-border-dark rounded-full flex items-center justify-center text-slate-400 hover:text-soft-teal transition-all z-[110] shadow-md"
        type="button"
        aria-label="Toggle sidebar"
      >
        <svg className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="4" fill="none">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </aside>
  );
};

export default Sidebar;
