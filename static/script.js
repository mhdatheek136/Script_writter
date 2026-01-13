document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const progress = document.getElementById('progress');
    const progressText = document.getElementById('progressText');
    const results = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const errorDiv = document.getElementById('error');
    const processBtn = document.getElementById('processBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadOptions = document.getElementById('downloadOptions');
    const emptyState = document.getElementById('empty-state');
    const appContainer = document.querySelector('.app-container');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const globalRewriteSection = document.getElementById('global-rewrite-container');
    const globalRewriteBtn = document.getElementById('globalRewriteBtn');
    const globalRewriteRequest = document.getElementById('global_rewrite_request');
    const newPresentationBtn = document.getElementById('newPresentationBtn');

    // Modal elements
    const customModal = document.getElementById('custom-modal');
    const modalConfirmBtn = document.getElementById('modal-confirm');
    const modalCancelBtn = document.getElementById('modal-cancel');

    const STORAGE_KEY = 'slide_narration_results';
    let currentResults = null;

    // Mobile Sidebar Toggle
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-show');
            sidebarOverlay.classList.toggle('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-show');
            sidebarOverlay.classList.remove('active');
        });
    }

    function closeSidebarMobile() {
        if (sidebar) sidebar.classList.remove('mobile-show');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    // Toggle download dropdown
    if (downloadBtn && downloadOptions) {
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadOptions.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            downloadOptions.classList.remove('show');
        });
    }

    // New Presentation handler
    if (newPresentationBtn) {
        newPresentationBtn.addEventListener('click', () => {
            if (currentResults) {
                showModal();
            } else {
                clearSession();
            }
        });
    }

    function showModal() {
        if (customModal) {
            customModal.classList.remove('hidden');
        }
    }

    function hideModal() {
        if (customModal) {
            customModal.classList.add('hidden');
        }
    }

    if (modalConfirmBtn) {
        modalConfirmBtn.addEventListener('click', () => {
            hideModal();
            clearSession();
        });
    }

    if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', hideModal);
    }

    // Close modal when clicking overlay
    if (customModal) {
        customModal.addEventListener('click', (e) => {
            if (e.target === customModal) {
                hideModal();
            }
        });
    }

    function clearSession() {
        localStorage.removeItem(STORAGE_KEY);
        currentResults = null;
        form.reset();
        results.classList.add('hidden');
        resultsContent.innerHTML = '';
        emptyState.classList.remove('hidden');
        appContainer.classList.remove('results-active');
        const fileLabel = document.querySelector('.file-custom-label span');
        if (fileLabel) fileLabel.textContent = 'Upload .pptx';
        window.location.reload();
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.classList.add('hidden');
        results.classList.add('hidden');
        emptyState.classList.add('hidden');
        progress.classList.remove('hidden');
        processBtn.disabled = true;
        progressText.textContent = 'Analyzing your slides...';
        closeSidebarMobile();

        const formData = new FormData(form);
        const tone = formData.get('tone');
        const dynamicLengthCheckbox = document.getElementById('dynamic_length');
        formData.set('dynamic_length', dynamicLengthCheckbox.checked ? 'true' : 'false');

        const customInstructions = document.getElementById('custom_instructions').value;
        formData.set('custom_instructions', customInstructions);

        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            progress.classList.add('hidden');
            processBtn.disabled = false;

            if (!response.ok || !data.success) {
                emptyState.classList.remove('hidden');
                showError(data.error || 'Failed to process presentation');
                return;
            }

            currentResults = data;
            currentResults.tone = tone;
            displayResults(data);
            populateDownloadOptions();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentResults));

        } catch (error) {
            progress.classList.add('hidden');
            processBtn.disabled = false;
            emptyState.classList.remove('hidden');
            showError('Network error: ' + error.message);
        }
    });

    function populateDownloadOptions() {
        downloadOptions.innerHTML = '';
        const formats = [
            { id: 'json', label: 'JSON Data (.json)' },
            { id: 'txt', label: 'Plain Text (.txt)' },
            { id: 'docx', label: 'Word Document (.docx)' },
            { id: 'pptx', label: 'PowerPoint (.pptx)' }
        ];

        formats.forEach(format => {
            const item = document.createElement('div');
            item.textContent = format.label;
            item.className = 'download-item';
            item.onclick = () => downloadFile(format.id);
            downloadOptions.appendChild(item);
        });
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function displayResults(data) {
        resultsContent.innerHTML = '';
        emptyState.classList.add('hidden');
        appContainer.classList.add('results-active');

        if (data.slides && data.slides.length > 0) {
            data.slides.forEach((slide, index) => {
                const slideDiv = document.createElement('div');
                slideDiv.className = 'slide-block';
                slideDiv.id = `slide-container-${index}`;

                slideDiv.innerHTML = `
                    <div class="block-header">
                        <div class="slide-avatar">${slide.slide_number}</div>
                        <div class="block-title">Slide ${slide.slide_number}</div>
                    </div>
                    <div class="content-section">
                        <div class="content-label">Transcribed Content</div>
                        <div class="notes-box">${escapeHtml(slide.rewritten_content)}</div>
                    </div>
                    <div class="content-section">
                        <div class="content-label">Original Speaker Notes</div>
                        <div class="notes-box">${slide.speaker_notes ? escapeHtml(slide.speaker_notes) : '<em>No notes available</em>'}</div>
                    </div>
                    <div class="content-section">
                        <div class="content-label">Generated Narration</div>
                        <div class="narration-box" id="narration-${index}">${formatNarration(slide.narration_paragraph)}</div>
                        <div class="block-actions">
                            <button class="icon-btn" onclick="copyNarration(${index})" title="Copy Narration">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>
                            </button>
                            <button class="rewrite-btn" onclick="toggleRewriteForm(${index})">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Rewrite
                            </button>
                        </div>
                        <div class="rewrite-form hidden" id="rewrite-form-${index}">
                            <textarea id="rewrite-request-${index}" placeholder="How should I change this? (e.g., 'More professional', 'Add a hook')" rows="3"></textarea>
                            <div class="rewrite-footer">
                                <div class="rewrite-actions">
                                    <button class="btn-mini submit" onclick="submitRewrite(${index})">Generate</button>
                                    <button class="btn-mini cancel" onclick="toggleRewriteForm(${index})">Cancel</button>
                                </div>
                                <div class="rewrite-loading hidden" id="rewrite-loading-${index}">
                                    <div class="mini-spinner"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                resultsContent.appendChild(slideDiv);
            });
        }
        results.classList.remove('hidden');
    }

    window.copyNarration = function (index) {
        if (!currentResults || !currentResults.slides || !currentResults.slides[index]) return;
        const narration = currentResults.slides[index].narration_paragraph;
        copyToClipboard(narration);
        showSuccessMessage(`Narration ${index + 1} copied`);
    };

    window.toggleRewriteForm = function (index) {
        const form = document.getElementById(`rewrite-form-${index}`);
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) {
            document.getElementById(`rewrite-request-${index}`).focus();
        }
    };

    window.submitRewrite = async function (index) {
        const requestInput = document.getElementById(`rewrite-request-${index}`);
        const userRequest = requestInput.value.trim();
        if (!userRequest || !currentResults || !currentResults.slides || !currentResults.slides[index]) return;

        const slide = currentResults.slides[index];
        const loading = document.getElementById(`rewrite-loading-${index}`);
        const requestForm = document.getElementById(`rewrite-form-${index}`);
        const submitBtn = requestForm.querySelector('.btn-mini.submit');

        loading.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('slide_number', slide.slide_number);
            formData.append('current_narration', slide.narration_paragraph);
            formData.append('rewritten_content', slide.rewritten_content);
            formData.append('speaker_notes', slide.speaker_notes);
            formData.append('user_request', userRequest);
            formData.append('tone', currentResults.tone || 'Professional');

            const response = await fetch('/api/rewrite-narration', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                currentResults.slides[index].narration_paragraph = data.rewritten_narration;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentResults));
                document.getElementById(`narration-${index}`).innerHTML = formatNarration(data.rewritten_narration);
                requestInput.value = '';
                toggleRewriteForm(index);
                showSuccessMessage(`Slide ${slide.slide_number} updated`);
            } else {
                alert(data.error || 'Failed to rewrite');
            }
        } catch (error) {
            console.error('Rewrite error:', error);
            alert('Error: ' + error.message);
        } finally {
            loading.classList.add('hidden');
            submitBtn.disabled = false;
        }
    };

    if (globalRewriteBtn) {
        globalRewriteBtn.addEventListener('click', async () => {
            const userRequest = globalRewriteRequest.value.trim();
            if (!userRequest || !currentResults || !currentResults.slides) return;

            const originalText = globalRewriteBtn.innerHTML;
            globalRewriteBtn.innerHTML = '<div class="mini-spinner"></div> Rewriting...';
            globalRewriteBtn.disabled = true;

            try {
                const formData = new FormData();
                formData.append('user_request', userRequest);
                formData.append('slides_json', JSON.stringify(currentResults.slides));
                formData.append('tone', currentResults.tone || 'Professional');

                const response = await fetch('/api/global-rewrite', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if (data.success) {
                    currentResults.slides = data.slides;
                    displayResults(currentResults);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentResults));
                    globalRewriteRequest.value = '';
                    showSuccessMessage('Global rewrite complete');
                } else {
                    alert(data.error || 'Failed to rewrite narrations');
                }
            } catch (error) {
                console.error('Global rewrite error:', error);
                alert('Error: ' + error.message);
            } finally {
                globalRewriteBtn.innerHTML = originalText;
                globalRewriteBtn.disabled = false;
            }
        });
    }

    copyAllBtn.addEventListener('click', () => {
        if (!currentResults || !currentResults.slides) return;
        let allText = `Slide Narration AI Results\n\n`;
        currentResults.slides.forEach(slide => {
            allText += `--- Slide ${slide.slide_number} ---\n\nContent:\n${slide.rewritten_content}\n\nNarration:\n${slide.narration_paragraph}\n\n\n`;
        });
        copyToClipboard(allText);
        showSuccessMessage('Copied to clipboard');
    });

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNarration(narration) {
        if (!narration) return '';
        return narration.split('\n\n').map(p => {
            const escaped = escapeHtml(p.trim());
            return escaped ? `<p>${escaped}</p>` : '';
        }).filter(p => p).join('');
    }

    async function downloadFile(format) {
        if (!currentResults || !currentResults.session_id) return;
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<div class="mini-spinner"></div> Gen...';
        downloadBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('session_id', currentResults.session_id);
            formData.append('base_name', currentResults.base_name);
            formData.append('format_type', format);
            formData.append('slides_json', JSON.stringify(currentResults.slides));

            const response = await fetch('/api/generate-output', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = format === 'pptx' ? 'pptx' : (format === 'docx' ? 'docx' : (format === 'json' ? 'json' : 'txt'));
            a.download = `${currentResults.base_name}_narration.${ext}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }
    }

    function showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 2500);
    }

    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            currentResults = JSON.parse(savedData);
            displayResults(currentResults);
            populateDownloadOptions();
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    const customInstructionsTextarea = document.getElementById('custom_instructions');
    if (customInstructionsTextarea) {
        customInstructionsTextarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
});
