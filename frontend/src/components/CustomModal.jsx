import React from 'react';

const CustomModal = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onCancel} />

            <div className="relative bg-white dark:bg-ui-surface-dark w-full max-w-md rounded-[3rem] shadow-2xl p-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 border border-soft-border dark:border-slate-800">

                <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500/5 flex items-center justify-center mb-10 border border-rose-500/10">
                    <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-rose-500"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>

                <h3 className="text-2xl font-bold mb-4 tracking-tight dark:text-white uppercase leading-none">Confirm Reset</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-12 px-6 font-bold tracking-tight">
                    This will clear all current narration data. This action is final and cannot be undone.
                </p>

                <div className="w-full space-y-4">
                    <button
                        onClick={onConfirm}
                        className="w-full py-5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[0.7rem] uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-rose-500/20 active:scale-[0.98]"
                    >
                        Reset Project
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[0.7rem] uppercase tracking-widest rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98]"
                    >
                        Keep Working
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomModal;
