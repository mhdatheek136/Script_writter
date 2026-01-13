import React, { useState } from 'react';

const GlobalRefinement = ({ slides, tone, onUpdate, isDarkMode }) => {
    const [request, setRequest] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGlobalRewrite = async () => {
        if (!request.trim() || !slides) return;
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('user_request', request);
        formData.append('slides_json', JSON.stringify(slides));
        formData.append('tone', tone || 'Professional');

        try {
            const response = await fetch('/api/global-rewrite', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                onUpdate(data.slides);
                setRequest('');
            } else { alert('Global update failed.'); }
        } catch (err) { alert('Network error: ' + err.message); } finally { setIsSubmitting(false); }
    };

    return (
        <div className={`card-soft mb-12 relative overflow-hidden group border-none shadow-2xl ${isDarkMode ? 'bg-ui-surface-dark/40 shadow-none' : 'bg-white shadow-slate-200/40'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${isDarkMode ? 'bg-soft-teal' : 'bg-soft-navy'}`} />
            <div className="flex flex-col gap-8 p-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-soft-teal/10 text-soft-teal border-soft-teal/20' : 'bg-soft-navy/5 text-soft-navy border-soft-navy/20'}`}>
                        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight uppercase mb-0.5">Global Refinement</h3>
                        <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Apply changes to all slides</span>
                    </div>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-bold max-w-2xl">
                    Enter an instruction to rewrite the entire script concurrently. This ensures consistency
                    across your entire presentation.
                </p>

                <div className="flex flex-col md:flex-row gap-5">
                    <textarea
                        value={request}
                        onChange={(e) => setRequest(e.target.value)}
                        placeholder="E.g. 'Ensure every slide has a summary'..."
                        className="flex-1 bg-slate-100/30 dark:bg-black/40 border border-soft-border dark:border-slate-800 rounded-2xl p-5 text-sm resize-none focus:ring-2 focus:ring-soft-teal/5 transition-all outline-none shadow-inner"
                        rows="2"
                    />
                    <button
                        type="button"
                        onClick={handleGlobalRewrite}
                        disabled={isSubmitting || !request.trim()}
                        className={`md:w-36 flex flex-col items-center justify-center rounded-2xl p-4 transition-all duration-500 ${isSubmitting ? 'opacity-50' : 'hover:scale-[1.02] active:scale-[0.98] shadow-2xl'} ${isDarkMode ? 'bg-soft-teal text-black shadow-soft-teal/20' : 'bg-soft-navy text-white shadow-soft-navy/20'}`}
                    >
                        {isSubmitting ? <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                            <>
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" className="mb-1"><path d="M12 19l7-7-7-7M5 12h14" /></svg>
                                <span className="text-[0.6rem] font-bold uppercase tracking-widest">Apply All</span>
                            </>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalRefinement;
