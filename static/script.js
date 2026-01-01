document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const progress = document.getElementById('progress');
    const progressText = document.getElementById('progressText');
    const results = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const errorDiv = document.getElementById('error');
    const processBtn = document.getElementById('processBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');

    let currentResults = null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset UI
        errorDiv.classList.add('hidden');
        results.classList.add('hidden');
        progress.classList.remove('hidden');
        processBtn.disabled = true;
        progressText.textContent = 'Processing presentation...';

        const formData = new FormData(form);
        
        // Handle checkbox for dynamic_length
        const dynamicLengthCheckbox = document.getElementById('dynamic_length');
        formData.set('dynamic_length', dynamicLengthCheckbox.checked ? 'true' : 'false');
        
        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            progress.classList.add('hidden');
            processBtn.disabled = false;

            if (!response.ok || !data.success) {
                showError(data.error || 'Failed to process presentation');
                return;
            }

            currentResults = data;
            displayResults(data);
            
        } catch (error) {
            progress.classList.add('hidden');
            processBtn.disabled = false;
            showError('Network error: ' + error.message);
        }
    });

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    function displayResults(data) {
        resultsContent.innerHTML = '';
        
        if (data.slides && data.slides.length > 0) {
            data.slides.forEach((slide, index) => {
                const slideDiv = document.createElement('div');
                slideDiv.className = 'slide-result';
                
                slideDiv.innerHTML = `
                    <h3>Slide ${slide.slide_number}</h3>
                    <div class="result-section">
                        <h4>Rewritten Content</h4>
                        <p>${escapeHtml(slide.rewritten_content)}</p>
                    </div>
                    <div class="result-section">
                        <h4>Speaker Notes</h4>
                        <p>${escapeHtml(slide.speaker_notes)}</p>
                    </div>
                    <div class="result-section">
                        <h4>Narration</h4>
                        <div class="narration-content">${formatNarration(slide.narration_paragraph)}</div>
                    </div>
                    <button class="copy-btn" onclick="copySlide(${index})">Copy Slide ${slide.slide_number}</button>
                `;
                
                resultsContent.appendChild(slideDiv);
            });
        }
        
        results.classList.remove('hidden');
    }

    window.copySlide = function(index) {
        if (!currentResults || !currentResults.slides || !currentResults.slides[index]) {
            return;
        }
        
        const slide = currentResults.slides[index];
        // Preserve paragraph breaks in narration when copying
        const narration = slide.narration_paragraph.replace(/\n\n/g, '\n\n');
        const text = `Slide ${slide.slide_number}\n\n` +
                    `Rewritten Content:\n${slide.rewritten_content}\n\n` +
                    `Speaker Notes:\n${slide.speaker_notes}\n\n` +
                    `Narration:\n${narration}`;
        
        copyToClipboard(text);
        showSuccessMessage(`Copied Slide ${slide.slide_number} to clipboard`);
    };

    copyAllBtn.addEventListener('click', () => {
        if (!currentResults || !currentResults.slides) {
            return;
        }
        
        let allText = `Slide-to-Narration Rewriter Results\n` +
                     `Total Slides: ${currentResults.total_slides}\n\n`;
        
        currentResults.slides.forEach(slide => {
            // Preserve paragraph breaks in narration
            const narration = slide.narration_paragraph.replace(/\n\n/g, '\n\n');
            allText += `=== Slide ${slide.slide_number} ===\n\n` +
                      `Rewritten Content:\n${slide.rewritten_content}\n\n` +
                      `Speaker Notes:\n${slide.speaker_notes}\n\n` +
                      `Narration:\n${narration}\n\n` +
                      `---\n\n`;
        });
        
        copyToClipboard(allText);
        showSuccessMessage('All results copied to clipboard');
    });

    downloadJsonBtn.addEventListener('click', () => {
        if (!currentResults) {
            return;
        }
        
        const jsonStr = JSON.stringify(currentResults, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'presentation-results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Failed to copy:', err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textarea);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNarration(narration) {
        if (!narration) return '';
        // Replace double newlines with paragraph breaks
        const paragraphs = narration.split('\n\n');
        return paragraphs.map(p => {
            const escaped = escapeHtml(p.trim());
            return escaped ? `<p>${escaped}</p>` : '';
        }).filter(p => p).join('');
    }

    function showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        results.insertBefore(successDiv, results.firstChild);
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }
});

