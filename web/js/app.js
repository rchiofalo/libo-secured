/**
 * libo-secured - USMC Correspondence Generator
 * Main Application JavaScript
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Storage keys
const STORAGE_KEY_PROFILES = 'libo_profiles';
const STORAGE_KEY_DRAFT = 'libo_draft';
const STORAGE_KEY_REFS = 'libo_draft_refs';
const STORAGE_KEY_ENCLS = 'libo_draft_encls';
const STORAGE_KEY_COPYTOS = 'libo_draft_copytos';
const STORAGE_KEY_PARAS = 'libo_draft_paragraphs';

// Draft data version (increment when format changes)
const DRAFT_VERSION = '1.0';

// Auto-save debounce timer
let autoSaveTimer = null;

// Pending restore callback
let pendingRestoreCallback = null;

// =============================================================================
// SWIFTLATEX ENGINE
// =============================================================================

let pdfTexEngine = null;
let engineReady = false;
let engineLoading = false;

/**
 * Reset the LaTeX engine (required after fatal errors)
 */
async function resetLatexEngine() {
    console.log('Resetting LaTeX engine...');
    engineReady = false;
    engineLoading = false;
    pdfTexEngine = null;
    await initLatexEngine();
}

/**
 * Initialize SwiftLaTeX PdfTeX engine
 */
async function initLatexEngine() {
    if (engineReady || engineLoading) return;

    if (typeof PdfTeXEngine === 'undefined') {
        console.warn('SwiftLaTeX PdfTeXEngine not loaded');
        return;
    }

    engineLoading = true;
    showStatus('Loading LaTeX engine...', 'success');

    try {
        pdfTexEngine = new PdfTeXEngine();
        await pdfTexEngine.loadEngine();

        // Pre-load bundled TeX Live packages into kpathsea cache
        // This bypasses HTTP fetch and works fully offline
        if (typeof TEXLIVE_PACKAGES !== 'undefined' && Array.isArray(TEXLIVE_PACKAGES)) {
            console.log('Preloading TeX Live packages into kpathsea cache...');
            let packageCount = 0;
            for (const pkg of TEXLIVE_PACKAGES) {
                pdfTexEngine.preloadTexliveFile(pkg.format, pkg.filename, pkg.content);
                packageCount++;
            }
            console.log(`Preloaded ${packageCount} TeX Live packages`);
        }

        // Pre-load bundled font metrics (base64 decoded)
        if (typeof TEXLIVE_FONTS !== 'undefined' && Array.isArray(TEXLIVE_FONTS)) {
            console.log('Preloading font metrics...');
            let fontCount = 0;
            for (const font of TEXLIVE_FONTS) {
                // Debug logging for first few fonts
                if (fontCount < 3) {
                    console.log(`Font ${fontCount}: ${font.filename}, base64 length: ${font.content.length}`);
                }

                // Decode base64 to binary
                const binaryString = atob(font.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Debug decoded size for cmmi8.tfm specifically
                if (font.filename === 'cmmi8.tfm') {
                    console.log(`CRITICAL: cmmi8.tfm decoded to ${bytes.length} bytes`);
                    console.log(`First 10 bytes: ${Array.from(bytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }

                pdfTexEngine.preloadTexliveFile(font.format, font.filename, bytes);
                fontCount++;
            }
            console.log(`Preloaded ${fontCount} font metrics`);
        }

        // Pre-load Type1 fonts (base64 decoded)
        if (typeof TEXLIVE_TYPE1_FONTS !== 'undefined' && Array.isArray(TEXLIVE_TYPE1_FONTS)) {
            console.log('Preloading Type1 fonts...');
            let type1Count = 0;
            for (const font of TEXLIVE_TYPE1_FONTS) {
                // Decode base64 to binary
                const binaryString = atob(font.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                pdfTexEngine.preloadTexliveFile(font.format, font.filename, bytes);
                type1Count++;
            }
            console.log(`Preloaded ${type1Count} Type1 fonts`);
        }

        // Pre-load Virtual fonts (base64 decoded)
        if (typeof TEXLIVE_VF_FONTS !== 'undefined' && Array.isArray(TEXLIVE_VF_FONTS)) {
            console.log('Preloading Virtual fonts...');
            let vfCount = 0;
            for (const font of TEXLIVE_VF_FONTS) {
                // Decode base64 to binary
                const binaryString = atob(font.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                pdfTexEngine.preloadTexliveFile(font.format, font.filename, bytes);
                vfCount++;
            }
            console.log(`Preloaded ${vfCount} Virtual fonts`);
        }

        // Wait for worker to process all preload messages
        // postMessage is async, so we need to give the worker time to process
        // Increased from 200ms to 1000ms to ensure all TFM fonts are preloaded
        console.log('Waiting for worker to process preload messages...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Preload wait complete');

        engineReady = true;
        engineLoading = false;
        console.log('SwiftLaTeX engine ready with bundled packages');
    } catch (error) {
        console.error('Failed to load SwiftLaTeX engine:', error);
        engineLoading = false;
    }
}

/**
 * Compile LaTeX document using SwiftLaTeX
 */
async function compileLatex() {
    if (!engineReady) {
        await initLatexEngine();
        if (!engineReady) {
            throw new Error('LaTeX engine not available');
        }
    }

    const data = collectData();

    // Create virtual filesystem directories
    pdfTexEngine.makeMemFSFolder('config');
    pdfTexEngine.makeMemFSFolder('formats');
    pdfTexEngine.makeMemFSFolder('attachments');
    pdfTexEngine.makeMemFSFolder('enclosures');

    // Write bundled attachment files (like dod-seal.png)
    if (typeof TEXLIVE_ATTACHMENTS !== 'undefined' && Array.isArray(TEXLIVE_ATTACHMENTS)) {
        for (const attachment of TEXLIVE_ATTACHMENTS) {
            // Decode base64 to binary
            const binaryString = atob(attachment.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            pdfTexEngine.writeMemFSFile(`attachments/${attachment.filename}`, bytes);
            console.log(`Wrote attachment: ${attachment.filename}`);
        }
    }

    // Note: Enclosure PDFs are merged by JavaScript after compilation
    // SwiftLaTeX doesn't support \includepdf for external PDFs

    // Test with minimal document first (for debugging)
    // Set to true to test basic compilation without complex packages
    const USE_MINIMAL_TEST = false; // Full template mode

    if (USE_MINIMAL_TEST) {
        const minimalTex = `\\documentclass{article}
\\begin{document}
Hello World!
\\end{document}`;
        pdfTexEngine.writeMemFSFile('main.tex', minimalTex);
    } else {
        // Write main.tex from templates (stored at tex/main.tex, written to root for SwiftLaTeX)
        if (window.LATEX_TEMPLATES && window.LATEX_TEMPLATES['tex/main.tex']) {
            pdfTexEngine.writeMemFSFile('main.tex', window.LATEX_TEMPLATES['tex/main.tex']);
        } else {
            throw new Error('LaTeX templates not loaded');
        }
    }

    // Write format files from templates (tex/templates/ -> root level for SwiftLaTeX)
    for (const [filename, content] of Object.entries(window.LATEX_TEMPLATES)) {
        if (filename.startsWith('tex/templates/')) {
            // Strip tex/templates/ prefix - SwiftLaTeX doesn't support subdirectories
            const flatName = filename.replace('tex/templates/', '');
            pdfTexEngine.writeMemFSFile(flatName, content);
        }
    }

    // Generate and write config files dynamically (all at root level for SwiftLaTeX)
    pdfTexEngine.writeMemFSFile('document.tex', generateDocumentTex(data));
    pdfTexEngine.writeMemFSFile('letterhead.tex', generateLetterheadTex(data));
    pdfTexEngine.writeMemFSFile('signatory.tex', generateSignatoryTex(data));

    // Generate flags file (tells LaTeX whether refs/encls exist)
    const flagsTex = generateFlagsTex();
    console.log('Writing flags.tex:', flagsTex);
    pdfTexEngine.writeMemFSFile('flags.tex', flagsTex);

    const refsTex = generateReferencesTex();
    console.log('Writing references.tex:', refsTex);
    pdfTexEngine.writeMemFSFile('references.tex', refsTex);

    pdfTexEngine.writeMemFSFile('reference-urls.tex', generateReferenceUrlsTex());

    const enclTex = generateEnclosuresTex();
    console.log('Writing encl-config.tex:', enclTex);
    pdfTexEngine.writeMemFSFile('encl-config.tex', enclTex);

    pdfTexEngine.writeMemFSFile('copyto-config.tex', generateCopyToTex());

    pdfTexEngine.writeMemFSFile('body.tex', generateBodyTex(data));
    pdfTexEngine.writeMemFSFile('classification.tex', generateClassificationTex(data));

    // Set main file and compile
    pdfTexEngine.setEngineMainFile('main.tex');

    showStatus('Compiling LaTeX...', 'success');
    const result = await pdfTexEngine.compileLaTeX();

    if (result.status === 0 && result.pdf) {
        return result.pdf;
    } else {
        console.error('LaTeX compilation failed:', result.log);

        // Check for fatal format error - engine needs reset
        if (result.log && result.log.includes('Fatal format file error')) {
            console.warn('Fatal format error detected - engine needs reset');
            throw new Error('ENGINE_RESET_NEEDED');
        }

        // Debug: Show log in UI
        const existingDebug = document.getElementById('latex-debug-log');
        if (existingDebug) existingDebug.remove();

        const debugDiv = document.createElement('pre');
        debugDiv.id = 'latex-debug-log';
        debugDiv.style.whiteSpace = 'pre-wrap';
        debugDiv.style.border = '1px solid red';
        debugDiv.style.padding = '10px';
        debugDiv.style.margin = '10px';
        debugDiv.style.backgroundColor = '#fff0f0';
        debugDiv.textContent = result.log;
        document.querySelector('.container').appendChild(debugDiv);

        throw new Error('LaTeX compilation failed. Check console for details.');
    }
}

// =============================================================================
// DOCUMENT TYPE CONFIGURATIONS
// =============================================================================

const docTypeConfig = {
    // Letters - have letterhead, SSIC, From/To
    // regulations: { fontSize, fontFamily } - what's compliant per SECNAV M-5216.5
    naval_letter: {
        letterhead: true, ssic: true, fromTo: true, via: true, memoHeader: false, signature: 'abbrev', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 2-20' }
    },
    standard_letter: {
        letterhead: false, ssic: true, fromTo: true, via: true, memoHeader: false, signature: 'abbrev', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 2-20' }
    },
    business_letter: {
        letterhead: true, ssic: false, fromTo: false, via: false, memoHeader: false, signature: 'full', business: true, uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'times', ref: 'Ch 3' }
    },
    multiple_address_letter: {
        letterhead: true, ssic: true, fromTo: true, via: true, memoHeader: false, signature: 'abbrev', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 8' }
    },
    joint_letter: {
        letterhead: true, ssic: true, fromTo: true, via: false, memoHeader: false, signature: 'abbrev', uiMode: 'joint',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 7' }
    },
    // Endorsements
    same_page_endorsement: {
        letterhead: false, ssic: false, fromTo: true, via: false, memoHeader: false, signature: 'abbrev', endorsement: true, uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 9' }
    },
    new_page_endorsement: {
        letterhead: true, ssic: true, fromTo: true, via: false, memoHeader: false, signature: 'abbrev', endorsement: true, uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 9' }
    },
    // Memorandums
    mfr: {
        letterhead: false, ssic: false, fromTo: false, via: false, memoHeader: 'MEMORANDUM FOR THE RECORD', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-1' }
    },
    plain_paper_memorandum: {
        letterhead: false, ssic: false, fromTo: true, via: false, memoHeader: 'MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-3' }
    },
    letterhead_memorandum: {
        letterhead: true, ssic: false, fromTo: true, via: false, memoHeader: 'MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-4' }
    },
    decision_memorandum: {
        letterhead: true, ssic: false, fromTo: true, via: false, memoHeader: 'DECISION MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-5' }
    },
    moa: {
        letterhead: true, ssic: false, fromTo: false, via: false, memoHeader: 'MEMORANDUM OF AGREEMENT', signature: 'full', uiMode: 'moa',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-6' }
    },
    mou: {
        letterhead: true, ssic: false, fromTo: false, via: false, memoHeader: 'MEMORANDUM OF UNDERSTANDING', signature: 'full', uiMode: 'moa',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 10-6' }
    },
    joint_memorandum: {
        letterhead: true, ssic: true, fromTo: true, via: false, memoHeader: 'JOINT MEMORANDUM', signature: 'full', uiMode: 'joint',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'Ch 7' }
    },
    // Executive
    standard_memorandum: {
        letterhead: true, ssic: false, fromTo: true, via: false, memoHeader: 'MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'times', ref: 'Ch 12' }
    },
    action_memorandum: {
        letterhead: true, ssic: false, fromTo: true, via: false, memoHeader: 'ACTION MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'times', ref: 'Ch 12' }
    },
    information_memorandum: {
        letterhead: true, ssic: false, fromTo: true, via: false, memoHeader: 'INFORMATION MEMORANDUM', signature: 'full', uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'times', ref: 'Ch 12' }
    },
    // USMC-Specific
    mf: {
        letterhead: true, ssic: false, fromTo: false, via: false, memoHeader: 'MEMORANDUM FOR', signature: 'full', memoFor: true, uiMode: 'standard',
        regulations: { fontSize: '12pt', fontFamily: 'courier', ref: 'MCO 5216.20B' }
    }
};

/**
 * Update UI fields visibility based on document type
 */
function updateDocTypeFields() {
    const docType = document.getElementById('docType').value;
    const config = docTypeConfig[docType] || docTypeConfig.naval_letter;
    const uiMode = config.uiMode || 'standard';

    // Hide all mode-specific sections
    document.getElementById('standardAddressing').style.display = 'none';
    document.getElementById('moaFields').style.display = 'none';
    document.getElementById('jointFields').style.display = 'none';
    document.getElementById('standardSignature').style.display = 'none';
    document.getElementById('moaSignatures').style.display = 'none';
    document.getElementById('jointSignatures').style.display = 'none';

    // Show appropriate sections based on uiMode
    if (uiMode === 'moa') {
        document.getElementById('moaFields').style.display = 'block';
        document.getElementById('moaSignatures').style.display = 'block';
    } else if (uiMode === 'joint') {
        document.getElementById('jointFields').style.display = 'block';
        document.getElementById('jointSignatures').style.display = 'block';
    } else {
        document.getElementById('standardAddressing').style.display = 'block';
        document.getElementById('standardSignature').style.display = 'block';
    }

    // Update regulation hints
    updateRegulationHighlights();

    // Update preview
    updatePreview();
}

/**
 * Update regulation compliance hints based on current selections
 */
function updateRegulationHighlights() {
    const docType = document.getElementById('docType').value;
    const config = docTypeConfig[docType] || docTypeConfig.naval_letter;
    const regs = config.regulations || {};

    const currentFontSize = document.getElementById('fontSize').value;
    const currentFontFamily = document.getElementById('fontFamily').value;

    const fontSizeHint = document.getElementById('fontSizeHint');
    const fontFamilyHint = document.getElementById('fontFamilyHint');
    const regPanel = document.getElementById('regulationHints');
    const regContent = document.getElementById('regulationContent');

    // Check font size compliance
    if (regs.fontSize) {
        if (currentFontSize === regs.fontSize) {
            fontSizeHint.textContent = '✓';
            fontSizeHint.className = 'reg-hint compliant';
        } else {
            fontSizeHint.textContent = regs.fontSize + ' recommended';
            fontSizeHint.className = 'reg-hint non-compliant';
        }
    } else {
        fontSizeHint.textContent = '';
        fontSizeHint.className = 'reg-hint';
    }

    // Check font family compliance
    if (regs.fontFamily) {
        const regFontName = regs.fontFamily === 'courier' ? 'Courier New' : 'Times New Roman';
        if (currentFontFamily === regs.fontFamily) {
            fontFamilyHint.textContent = '✓';
            fontFamilyHint.className = 'reg-hint compliant';
        } else {
            fontFamilyHint.textContent = regFontName + ' recommended';
            fontFamilyHint.className = 'reg-hint non-compliant';
        }
    } else {
        fontFamilyHint.textContent = '';
        fontFamilyHint.className = 'reg-hint';
    }

    // Show regulation panel with details
    if (regs.ref) {
        const regFontName = regs.fontFamily === 'courier' ? 'Courier New' : 'Times New Roman';
        regContent.innerHTML = `
            <ul>
                <li>Font: ${regFontName} ${regs.fontSize}</li>
                <li>Reference: SECNAV M-5216.5 ${regs.ref}</li>
            </ul>
        `;
        regPanel.style.display = 'block';
    } else {
        regPanel.style.display = 'none';
    }
}

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Toggle collapsible sections
 */
function toggleSection(el) {
    el.classList.toggle('collapsed');
    el.nextElementSibling.classList.toggle('hidden');
}

/**
 * Show status message
 */
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.style.display = 'block';
    status.className = 'status ' + type;
    status.textContent = message;
    if (type === 'success') {
        setTimeout(() => { status.style.display = 'none'; }, 4000);
    }
}

// =============================================================================
// ENCLOSURES MANAGEMENT
// =============================================================================

// Store enclosures with optional file attachments
let enclosures = [];

/**
 * Add a new enclosure (manual or with file)
 */
function addEnclosure(title = '', file = null) {
    console.log('addEnclosure called with title:', title, 'file:', file);
    const enclosure = {
        title: title,
        file: file ? {
            name: file.name,
            size: file.size,
            data: null
        } : null
    };

    enclosures.push(enclosure);
    console.log('enclosures array after push:', enclosures.length, enclosures);
    renderEnclosures();
    updatePreview();

    // If file provided, read it and update preview when ready
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            enclosure.file.data = e.target.result;
            // Trigger PDF preview update to include the new enclosure
            if (engineReady) {
                schedulePdfPreviewUpdate();
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

/**
 * Remove an enclosure
 */
function removeEnclosure(index) {
    enclosures.splice(index, 1);
    renderEnclosures();
    updatePreview();
}

/**
 * Update enclosure title
 */
function updateEnclosureTitle(index, title) {
    enclosures[index].title = title;
    updatePreview();
}

/**
 * Attach file to existing enclosure
 */
function attachFileToEnclosure(index, file) {
    if (file.type !== 'application/pdf') {
        showStatus('Only PDF files are allowed', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        enclosures[index].file = {
            name: file.name,
            size: file.size,
            data: e.target.result
        };
        renderEnclosures();
        // Trigger PDF preview update to include the new enclosure
        if (engineReady) {
            schedulePdfPreviewUpdate();
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Handle file input change for specific enclosure
 */
function handleEnclosureFileChange(event, index) {
    const file = event.target.files[0];
    if (file) {
        attachFileToEnclosure(index, file);
    }
    event.target.value = '';
}

/**
 * Handle file upload from drop zone (creates new enclosures)
 */
function handleEnclFileUpload(event) {
    const files = event.target.files;
    for (const file of files) {
        if (file.type === 'application/pdf') {
            // Use filename without extension as title
            const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
            addEnclosure(title, file);
        } else {
            showStatus('Only PDF files are allowed', 'error');
        }
    }
    event.target.value = '';
}

/**
 * Render the enclosures list with drag-and-drop support
 */
function renderEnclosures() {
    console.log('renderEnclosures called, enclosures.length:', enclosures.length);
    const container = document.getElementById('enclosuresList');
    console.log('enclosuresList container:', container);

    if (enclosures.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = enclosures.map((encl, index) => `
        <div class="enclosure-item" draggable="true" data-index="${index}">
            <span class="enclosure-drag-handle" title="Drag to reorder">⋮⋮</span>
            <span class="enclosure-number">(${index + 1})</span>
            <input type="text"
                   class="enclosure-input"
                   value="${escapeHtml(encl.title)}"
                   placeholder="Enclosure title"
                   oninput="updateEnclosureTitle(${index}, this.value)">
            ${encl.file
            ? `<span class="enclosure-file-indicator has-file" title="${escapeHtml(encl.file.name)}">📎 ${escapeHtml(encl.file.name)}</span>`
            : `<button type="button" class="enclosure-attach-btn">
                       📎 Attach
                       <input type="file" accept=".pdf" onchange="handleEnclosureFileChange(event, ${index})">
                   </button>`
        }
            <button type="button" class="enclosure-remove" onclick="removeEnclosure(${index})">×</button>
        </div>
    `).join('');

    // Add drag-and-drop event listeners
    initEnclosureDragDrop();
}

/**
 * Initialize drag-and-drop for enclosure reordering (mouse + touch)
 */
function initEnclosureDragDrop() {
    const container = document.getElementById('enclosuresList');
    const items = container.querySelectorAll('.enclosure-item');

    let draggedItem = null;
    let draggedIndex = null;

    // Mouse/HTML5 drag events (also works on iOS Safari with proper setup)
    items.forEach(item => {
        // Make handle the drag initiator
        const handle = item.querySelector('.enclosure-drag-handle');
        if (handle) {
            handle.style.webkitUserDrag = 'element';
        }

        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            // iOS Safari requires setData to be called
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(draggedIndex));
            // Set drag image if supported
            if (e.dataTransfer.setDragImage) {
                e.dataTransfer.setDragImage(item, 10, 10);
            }
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            draggedItem = null;
            draggedIndex = null;
            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            if (item === draggedItem) return;

            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));

            if (e.clientY < midY) {
                item.classList.add('drag-over-above');
            } else {
                item.classList.add('drag-over-below');
            }
        });

        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over-above', 'drag-over-below');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (item === draggedItem) return;

            const targetIndex = parseInt(item.dataset.index);
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            let newIndex = e.clientY < midY ? targetIndex : targetIndex + 1;

            if (draggedIndex < newIndex) {
                newIndex--;
            }

            reorderEnclosure(draggedIndex, newIndex);

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });
    });

    // Touch drag events for mobile (fallback for devices where HTML5 drag doesn't work)
    initTouchDragForList(container, 'enclosure-item', 'enclosure-drag-handle', reorderEnclosure);
}

/**
 * Generic touch drag handler for sortable lists
 * @param {HTMLElement} container - The list container
 * @param {string} itemClass - CSS class of draggable items
 * @param {string} handleClass - CSS class of drag handle
 * @param {Function} reorderFn - Function to call with (fromIndex, toIndex)
 */
function initTouchDragForList(container, itemClass, handleClass, reorderFn) {
    let touchDraggedItem = null;
    let touchDraggedIndex = null;
    let touchClone = null;
    let scrollInterval = null;
    let lastTargetIndex = null;

    container.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.' + handleClass);
        if (!handle) return;

        const item = handle.closest('.' + itemClass);
        if (!item) return;

        e.preventDefault();
        touchDraggedItem = item;
        touchDraggedIndex = parseInt(item.dataset.index);
        lastTargetIndex = null;

        // Create a clone for visual feedback
        touchClone = item.cloneNode(true);
        touchClone.classList.add('touch-dragging-clone');
        touchClone.style.position = 'fixed';
        touchClone.style.left = item.getBoundingClientRect().left + 'px';
        touchClone.style.top = e.touches[0].clientY - 20 + 'px';
        touchClone.style.width = item.offsetWidth + 'px';
        touchClone.style.zIndex = '9999';
        touchClone.style.opacity = '0.9';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        document.body.appendChild(touchClone);

        item.classList.add('dragging');
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (!touchDraggedItem || !touchClone) return;

        e.preventDefault();
        const touchY = e.touches[0].clientY;

        // Move the clone
        touchClone.style.top = touchY - 20 + 'px';

        // Auto-scroll if near edges
        const scrollThreshold = 50;
        if (touchY < scrollThreshold) {
            if (!scrollInterval) {
                scrollInterval = setInterval(() => window.scrollBy(0, -10), 16);
            }
        } else if (touchY > window.innerHeight - scrollThreshold) {
            if (!scrollInterval) {
                scrollInterval = setInterval(() => window.scrollBy(0, 10), 16);
            }
        } else {
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        }

        // Find the closest item and determine drop position
        const items = Array.from(container.querySelectorAll('.' + itemClass));
        items.forEach(item => item.classList.remove('drag-over-above', 'drag-over-below'));

        // Build list of item centers (excluding dragged item)
        const otherItems = items.filter(item => item !== touchDraggedItem);
        if (otherItems.length === 0) return;

        // Find which gap/position the touch is closest to
        let closestItem = null;
        let insertBefore = true;
        let minDistance = Infinity;

        for (const item of otherItems) {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;

            // Distance to top edge (insert before)
            const distToTop = Math.abs(touchY - rect.top);
            // Distance to bottom edge (insert after)
            const distToBottom = Math.abs(touchY - rect.bottom);

            if (distToTop < minDistance) {
                minDistance = distToTop;
                closestItem = item;
                insertBefore = true;
            }
            if (distToBottom < minDistance) {
                minDistance = distToBottom;
                closestItem = item;
                insertBefore = false;
            }
        }

        // Show indicator on closest item
        if (closestItem) {
            if (insertBefore) {
                closestItem.classList.add('drag-over-above');
            } else {
                closestItem.classList.add('drag-over-below');
            }
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (!touchDraggedItem) return;

        // Clear auto-scroll
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }

        // Remove clone
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }

        // Find drop target based on visual indicators
        const items = Array.from(container.querySelectorAll('.' + itemClass));
        let targetIndex = touchDraggedIndex;

        for (const item of items) {
            const itemIndex = parseInt(item.dataset.index);
            if (item.classList.contains('drag-over-above')) {
                // Insert before this item
                targetIndex = itemIndex;
                if (touchDraggedIndex < itemIndex) {
                    targetIndex--; // Adjust because we're removing from before
                }
                break;
            }
            if (item.classList.contains('drag-over-below')) {
                // Insert after this item
                targetIndex = itemIndex + 1;
                if (touchDraggedIndex < itemIndex + 1) {
                    targetIndex--; // Adjust because we're removing from before
                }
                break;
            }
        }

        // Clean up
        touchDraggedItem.classList.remove('dragging');
        items.forEach(item => item.classList.remove('drag-over-above', 'drag-over-below'));

        // Reorder if position changed
        if (targetIndex !== touchDraggedIndex && targetIndex >= 0) {
            reorderFn(touchDraggedIndex, targetIndex);
        }

        touchDraggedItem = null;
        touchDraggedIndex = null;
    });

    // Handle touch cancel
    container.addEventListener('touchcancel', () => {
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }
        if (touchDraggedItem) {
            touchDraggedItem.classList.remove('dragging');
        }
        const items = container.querySelectorAll('.' + itemClass);
        items.forEach(item => item.classList.remove('drag-over-above', 'drag-over-below'));
        touchDraggedItem = null;
        touchDraggedIndex = null;
    });
}

/**
 * Reorder enclosure from one index to another
 */
function reorderEnclosure(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const item = enclosures.splice(fromIndex, 1)[0];
    enclosures.splice(toIndex, 0, item);
    renderEnclosures();
    updatePreview();
}

// =============================================================================
// REFERENCES MANAGEMENT
// =============================================================================

// Store references with optional URLs
let references = [
    { letter: 'a', title: 'SECNAV M-5216.5', url: '' },
    { letter: 'b', title: 'MCO 5216.20B', url: '' }
];

/**
 * Add a new reference
 */
function addReference(title = '', url = '') {
    // Auto-generate next letter
    const nextLetter = String.fromCharCode(97 + references.length); // 'a' = 97
    references.push({
        letter: nextLetter,
        title: title,
        url: url
    });
    renderReferences();
    updatePreview();
}

/**
 * Remove a reference
 */
function removeReference(index) {
    references.splice(index, 1);
    // Re-letter remaining references
    references.forEach((ref, i) => {
        ref.letter = String.fromCharCode(97 + i);
    });
    renderReferences();
    updatePreview();
}

/**
 * Update reference title
 */
function updateReferenceTitle(index, title) {
    references[index].title = title;
    updatePreview();
}

/**
 * Update reference URL
 */
function updateReferenceUrl(index, url) {
    references[index].url = url;
    updatePreview();
}

/**
 * Render the references list with drag-and-drop support
 */
function renderReferences() {
    const container = document.getElementById('referencesList');

    if (references.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = references.map((ref, index) => `
        <div class="reference-item" draggable="true" data-index="${index}">
            <span class="reference-drag-handle" title="Drag to reorder">⋮⋮</span>
            <span class="reference-letter">(${ref.letter})</span>
            <input type="text"
                   class="reference-title-input"
                   value="${escapeHtml(ref.title)}"
                   placeholder="Reference title"
                   oninput="updateReferenceTitle(${index}, this.value)">
            <input type="text"
                   class="reference-url-input"
                   value="${escapeHtml(ref.url || '')}"
                   placeholder="URL (optional)"
                   oninput="updateReferenceUrl(${index}, this.value)">
            <button type="button" class="reference-remove" onclick="removeReference(${index})">×</button>
        </div>
    `).join('');

    // Add drag-and-drop event listeners
    initReferenceDragDrop();
}

/**
 * Initialize drag-and-drop for reference reordering (mouse + touch)
 */
function initReferenceDragDrop() {
    const container = document.getElementById('referencesList');
    const items = container.querySelectorAll('.reference-item');

    let draggedItem = null;
    let draggedIndex = null;

    // Mouse/HTML5 drag events (also works on iOS Safari with proper setup)
    items.forEach(item => {
        // Make handle the drag initiator
        const handle = item.querySelector('.reference-drag-handle');
        if (handle) {
            handle.style.webkitUserDrag = 'element';
        }

        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            // iOS Safari requires setData to be called
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(draggedIndex));
            // Set drag image if supported
            if (e.dataTransfer.setDragImage) {
                e.dataTransfer.setDragImage(item, 10, 10);
            }
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            draggedItem = null;
            draggedIndex = null;
            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            if (item === draggedItem) return;

            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));

            if (e.clientY < midY) {
                item.classList.add('drag-over-above');
            } else {
                item.classList.add('drag-over-below');
            }
        });

        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over-above', 'drag-over-below');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (item === draggedItem) return;

            const targetIndex = parseInt(item.dataset.index);
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            let newIndex = e.clientY < midY ? targetIndex : targetIndex + 1;

            if (draggedIndex < newIndex) {
                newIndex--;
            }

            reorderReference(draggedIndex, newIndex);

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });
    });

    // Touch drag events for mobile (fallback for devices where HTML5 drag doesn't work)
    initTouchDragForList(container, 'reference-item', 'reference-drag-handle', reorderReference);
}

/**
 * Reorder reference from one index to another
 */
function reorderReference(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const item = references.splice(fromIndex, 1)[0];
    references.splice(toIndex, 0, item);

    // Re-letter references based on new order
    references.forEach((ref, i) => {
        ref.letter = String.fromCharCode(97 + i);
    });

    renderReferences();
    updatePreview();
}

// =============================================================================
// COPY TO (DISTRIBUTION) MANAGEMENT
// =============================================================================

// Store copy-to recipients
let copyTos = [];

/**
 * Add a new copy-to recipient
 */
function addCopyTo(recipient = '') {
    copyTos.push({ text: recipient });
    renderCopyTos();
    updatePreview();
}

/**
 * Remove a copy-to recipient
 */
function removeCopyTo(index) {
    copyTos.splice(index, 1);
    renderCopyTos();
    updatePreview();
}

/**
 * Update copy-to recipient text
 */
function updateCopyTo(index, text) {
    copyTos[index].text = text;
    updatePreview();
}

/**
 * Render the copy-to list
 */
function renderCopyTos() {
    const container = document.getElementById('copyToList');

    if (copyTos.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = copyTos.map((ct, index) => `
        <div class="copyto-item">
            <input type="text"
                   value="${escapeHtml(ct.text)}"
                   placeholder="e.g., CO, 1st Bn, 1st Mar"
                   oninput="updateCopyTo(${index}, this.value)">
            <button type="button" class="copyto-remove" onclick="removeCopyTo(${index})">×</button>
        </div>
    `).join('');
}

// =============================================================================
// PARAGRAPH MANAGEMENT
// =============================================================================

// USMC paragraph numbering scheme per SECNAV M-5216.5 Chapter 7, Para 13
// Maximum 8 levels of depth
// Level 1: 1., 2., 3...       (left margin)
// Level 2: a., b., c...       (4 spaces)
// Level 3: (1), (2), (3)...   (8 spaces)
// Level 4: (a), (b), (c)...   (12 spaces)
// Level 5: 1., 2., 3...       (16 spaces) - repeats
// Level 6: a., b., c...       (20 spaces)
// Level 7: (1), (2), (3)...   (24 spaces)
// Level 8: (a), (b), (c)...   (28 spaces)

const PARAGRAPH_INDENT_SPACES = 4; // Spaces per level
const MAX_PARAGRAPH_LEVELS = 8;

// Store paragraphs with hierarchical structure
// Each paragraph has: { text: string, level: number (0-7) }
let paragraphs = [
    { text: 'Per reference (a), this correspondence serves as an example of the naval letter format.', level: 0 },
    { text: 'The purpose of this letter is to demonstrate proper formatting in accordance with SECNAV M-5216.5.', level: 0 },
    { text: 'Point of contact for this matter is the undersigned at (910) 555-1234.', level: 0 }
];

/**
 * Get the paragraph numbering label for a given level and position
 * @param {number} level - The indentation level (0-7)
 * @param {number} count - The count within this level (1-based)
 * @returns {string} The formatted label (e.g., "1.", "a.", "(1)", "(a)")
 */
function getParagraphLabel(level, count) {
    // Levels cycle through 4 patterns
    const pattern = level % 4;

    switch (pattern) {
        case 0: // 1., 2., 3...
            return count + '.';
        case 1: // a., b., c...
            return String.fromCharCode(96 + count) + '.';
        case 2: // (1), (2), (3)...
            return '(' + count + ')';
        case 3: // (a), (b), (c)...
            return '(' + String.fromCharCode(96 + count) + ')';
        default:
            return count + '.';
    }
}

/**
 * Calculate display labels for all paragraphs based on hierarchy
 * @returns {string[]} Array of labels for each paragraph
 */
function calculateParagraphLabels() {
    const labels = [];
    const counters = [0, 0, 0, 0, 0, 0, 0, 0]; // Counter for each level

    for (let i = 0; i < paragraphs.length; i++) {
        const level = paragraphs[i].level || 0;

        // Increment the counter for this level
        counters[level]++;

        // Reset counters for deeper levels
        for (let j = level + 1; j < MAX_PARAGRAPH_LEVELS; j++) {
            counters[j] = 0;
        }

        labels.push(getParagraphLabel(level, counters[level]));
    }

    return labels;
}

/**
 * Add a new paragraph
 * @param {string} text - Initial text for the paragraph
 * @param {number} level - Indentation level (0-7), defaults to 0
 */
function addParagraph(text = '', level = 0) {
    paragraphs.push({ text: text, level: level });
    renderParagraphs();
    updatePreview();

    // Focus the new paragraph's textarea
    setTimeout(() => {
        const textareas = document.querySelectorAll('.paragraph-text');
        if (textareas.length > 0) {
            textareas[textareas.length - 1].focus();
        }
    }, 50);
}

/**
 * Remove a paragraph
 */
function removeParagraph(index) {
    if (paragraphs.length <= 1) {
        alert('You must have at least one paragraph.');
        return;
    }
    paragraphs.splice(index, 1);
    renderParagraphs();
    updatePreview();
}

/**
 * Update paragraph text
 */
function updateParagraphText(index, text) {
    paragraphs[index].text = text;
    updatePreview();
}

/**
 * Indent a paragraph (increase level)
 */
function indentParagraph(index) {
    const para = paragraphs[index];
    if (para.level < MAX_PARAGRAPH_LEVELS - 1) {
        // Per SECNAV M-5216.5: Can only indent one level at a time
        // and first sub-paragraph at a given level must be preceded by parent
        para.level++;
        renderParagraphs();
        updatePreview();
    }
}

/**
 * Outdent a paragraph (decrease level)
 */
function outdentParagraph(index) {
    const para = paragraphs[index];
    if (para.level > 0) {
        para.level--;
        renderParagraphs();
        updatePreview();
    }
}

/**
 * Move a paragraph up
 */
function moveParagraphUp(index) {
    if (index > 0) {
        reorderParagraph(index, index - 1);
    }
}

/**
 * Move a paragraph down
 */
function moveParagraphDown(index) {
    if (index < paragraphs.length - 1) {
        reorderParagraph(index, index + 1);
    }
}

/**
 * Add a sub-paragraph after the current one (one level deeper)
 */
function addSubParagraph(afterIndex) {
    const parentLevel = paragraphs[afterIndex].level || 0;
    const newLevel = Math.min(parentLevel + 1, MAX_PARAGRAPH_LEVELS - 1);

    // Insert after the current paragraph
    paragraphs.splice(afterIndex + 1, 0, { text: '', level: newLevel });
    renderParagraphs();
    updatePreview();

    // Focus the new paragraph
    setTimeout(() => {
        const textarea = document.querySelector(`.paragraph-text[data-index="${afterIndex + 1}"]`);
        if (textarea) textarea.focus();
    }, 50);
}

/**
 * Add a sibling paragraph at the same level
 */
function addSiblingParagraph(afterIndex) {
    const level = paragraphs[afterIndex].level || 0;

    // Insert after the current paragraph
    paragraphs.splice(afterIndex + 1, 0, { text: '', level: level });
    renderParagraphs();
    updatePreview();

    // Focus the new paragraph
    setTimeout(() => {
        const textarea = document.querySelector(`.paragraph-text[data-index="${afterIndex + 1}"]`);
        if (textarea) textarea.focus();
    }, 50);
}

/**
 * Find the last index of the subtree starting at the given index
 * A subtree includes all following paragraphs with level > the starting paragraph's level
 */
function findSubtreeEnd(startIndex) {
    const startLevel = paragraphs[startIndex].level || 0;
    let endIndex = startIndex;

    for (let i = startIndex + 1; i < paragraphs.length; i++) {
        const level = paragraphs[i].level || 0;
        if (level <= startLevel) {
            break; // Found a paragraph at same or higher level, subtree ends
        }
        endIndex = i;
    }

    return endIndex;
}

function addMainParagraph(afterIndex) {
    // Find the level 0 ancestor of the current paragraph
    let level0Index = afterIndex;
    for (let i = afterIndex; i >= 0; i--) {
        if ((paragraphs[i].level || 0) === 0) {
            level0Index = i;
            break;
        }
    }

    // Find the end of that level 0 paragraph's entire subtree
    let insertIndex = level0Index;
    for (let i = level0Index + 1; i < paragraphs.length; i++) {
        if ((paragraphs[i].level || 0) === 0) {
            break; // Found next level 0 paragraph
        }
        insertIndex = i;
    }
    insertIndex++; // Insert after the last child

    paragraphs.splice(insertIndex, 0, { text: '', level: 0 });
    renderParagraphs();
    updatePreview();

    // Focus the new paragraph
    setTimeout(() => {
        const textarea = document.querySelector(`.paragraph-text[data-index="${insertIndex}"]`);
        if (textarea) textarea.focus();
    }, 50);
}

/**
 * Add a paragraph one level up (parent level)
 */
function addParentParagraph(afterIndex) {
    const currentLevel = paragraphs[afterIndex].level || 0;
    const parentLevel = Math.max(0, currentLevel - 1);

    // Find the parent at parentLevel
    let parentIndex = afterIndex;
    for (let i = afterIndex; i >= 0; i--) {
        if ((paragraphs[i].level || 0) <= parentLevel) {
            parentIndex = i;
            break;
        }
    }

    // Find the end of that parent's subtree (all paragraphs with level > parentLevel)
    let insertIndex = parentIndex;
    for (let i = parentIndex + 1; i < paragraphs.length; i++) {
        if ((paragraphs[i].level || 0) <= parentLevel) {
            break; // Found a paragraph at same or higher level
        }
        insertIndex = i;
    }
    insertIndex++; // Insert after the last child

    paragraphs.splice(insertIndex, 0, { text: '', level: parentLevel });
    renderParagraphs();
    updatePreview();

    // Focus the new paragraph
    setTimeout(() => {
        const textarea = document.querySelector(`.paragraph-text[data-index="${insertIndex}"]`);
        if (textarea) textarea.focus();
    }, 50);
}

/**
 * Render the paragraphs list with drag-and-drop support
 */
function renderParagraphs() {
    const container = document.getElementById('paragraphsList');

    if (paragraphs.length === 0) {
        container.innerHTML = '<p style="color: #888; font-size: 12px;">No paragraphs. Click "Add Paragraph" to start.</p>';
        return;
    }

    // Calculate hierarchical labels
    const labels = calculateParagraphLabels();

    // Build citation path like "1a(1)" for display
    // This properly tracks the hierarchical numbering for nested paragraphs
    const getCitationPath = (idx) => {
        const currentLevel = paragraphs[idx].level || 0;

        // For each level from 0 to currentLevel, find the citation part
        const parts = [];

        for (let targetLevel = 0; targetLevel <= currentLevel; targetLevel++) {
            // Find where this level's list starts (after the parent at level-1)
            let listStart = 0;
            if (targetLevel > 0) {
                // Look backwards for the parent paragraph at targetLevel-1
                for (let i = idx; i >= 0; i--) {
                    if (paragraphs[i].level < targetLevel) {
                        listStart = i + 1;
                        break;
                    }
                }
            }

            // Count paragraphs at this level from listStart to idx
            let count = 0;
            for (let i = listStart; i <= idx; i++) {
                if (paragraphs[i].level === targetLevel) {
                    count++;
                }
            }

            // Get label for this level and count
            if (count > 0) {
                parts.push(getParagraphLabel(targetLevel, count).replace('.', ''));
            }
        }

        return parts.join('');
    };

    container.innerHTML = paragraphs.map((para, index) => {
        const level = para.level || 0;
        const citation = getCitationPath(index);

        return `
            <div class="paragraph-item" draggable="true" data-index="${index}" data-level="${level}">
                <div class="paragraph-header">
                    <span class="paragraph-level-badge">Level ${level + 1} ${citation}</span>
                    <div class="paragraph-move-btns">
                        <button type="button" class="para-move-btn" onclick="moveParagraphUp(${index})" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" class="para-move-btn" onclick="moveParagraphDown(${index})" title="Move down" ${index >= paragraphs.length - 1 ? 'disabled' : ''}>↓</button>
                    </div>
                </div>
                <textarea class="paragraph-text"
                          placeholder="Enter your paragraph content here..."
                          data-index="${index}"
                          oninput="updateParagraphText(${index}, this.value)">${escapeHtml(para.text)}</textarea>
                <div class="paragraph-actions">
                    <button type="button" class="para-action-btn para-action-main" onclick="addMainParagraph(${index})">Main Paragraph</button>
                    <button type="button" class="para-action-btn para-action-sub" onclick="addSubParagraph(${index})" ${level >= MAX_PARAGRAPH_LEVELS - 1 ? 'disabled' : ''}>Sub-paragraph</button>
                    ${level > 0 ? `<button type="button" class="para-action-btn para-action-same" onclick="addSiblingParagraph(${index})">Same</button>` : ''}
                    ${level > 1 ? `<button type="button" class="para-action-btn para-action-up" onclick="addParentParagraph(${index})">One Up</button>` : ''}
                    <button type="button" class="para-action-btn para-action-delete" onclick="removeParagraph(${index})" ${paragraphs.length <= 1 ? 'disabled' : ''}>Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Add drag-and-drop event listeners
    initParagraphDragDrop();

    // Add keyboard shortcuts for indent/outdent
    initParagraphKeyboardShortcuts();
}

/**
 * Initialize drag-and-drop for paragraph reordering
 * Improved: Drag works from anywhere on the left control area, not just the handle dots
 */
function initParagraphDragDrop() {
    const container = document.getElementById('paragraphsList');
    const items = container.querySelectorAll('.paragraph-item');

    let draggedItem = null;
    let draggedIndex = null;

    items.forEach(item => {
        // Make the whole controls area draggable, not just the handle
        const controlsArea = item.querySelector('.paragraph-controls');
        if (controlsArea) {
            controlsArea.style.cursor = 'grab';
        }

        // Start drag when mousedown on controls area
        item.addEventListener('dragstart', (e) => {
            // Only allow drag from the controls area or the item itself (not from textarea)
            if (e.target.closest('.paragraph-text') || e.target.closest('.paragraph-remove')) {
                e.preventDefault();
                return;
            }

            draggedItem = item;
            draggedIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(draggedIndex));

            // Create a better drag image
            const dragImage = item.cloneNode(true);
            dragImage.style.width = item.offsetWidth + 'px';
            dragImage.style.opacity = '0.8';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 20, 20);
            setTimeout(() => dragImage.remove(), 0);
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            draggedItem = null;
            draggedIndex = null;
            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';

            if (item === draggedItem || !draggedItem) return;

            const rect = item.getBoundingClientRect();
            // Use a larger zone (40% from top/bottom) instead of just midpoint
            const topZone = rect.top + rect.height * 0.4;
            const bottomZone = rect.top + rect.height * 0.6;

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));

            if (e.clientY < topZone) {
                item.classList.add('drag-over-above');
            } else if (e.clientY > bottomZone) {
                item.classList.add('drag-over-below');
            } else {
                // In the middle zone - show based on relative position
                if (parseInt(item.dataset.index) > draggedIndex) {
                    item.classList.add('drag-over-below');
                } else {
                    item.classList.add('drag-over-above');
                }
            }
        });

        item.addEventListener('dragleave', (e) => {
            // Only remove classes if actually leaving this item
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over-above', 'drag-over-below');
            }
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (item === draggedItem || draggedIndex === null) return;

            const targetIndex = parseInt(item.dataset.index);
            const rect = item.getBoundingClientRect();
            const topZone = rect.top + rect.height * 0.4;

            let newIndex = e.clientY < topZone ? targetIndex : targetIndex + 1;

            if (draggedIndex < newIndex) {
                newIndex--;
            }

            reorderParagraph(draggedIndex, newIndex);

            items.forEach(i => i.classList.remove('drag-over-above', 'drag-over-below'));
        });
    });

    // Also allow drag on the container itself (for dropping at the end)
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', (e) => {
        // Only handle if not dropped on an item
        if (e.target === container && draggedIndex !== null) {
            e.preventDefault();
            reorderParagraph(draggedIndex, paragraphs.length - 1);
        }
    });

    // Touch drag events for mobile - use the controls area
    initTouchDragForList(container, 'paragraph-item', 'paragraph-controls', reorderParagraph);
}

/**
 * Initialize keyboard shortcuts for paragraph indent/outdent
 */
function initParagraphKeyboardShortcuts() {
    const textareas = document.querySelectorAll('.paragraph-text');

    textareas.forEach(textarea => {
        textarea.addEventListener('keydown', (e) => {
            const index = parseInt(textarea.dataset.index);

            // Tab = indent, Shift+Tab = outdent
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    outdentParagraph(index);
                } else {
                    indentParagraph(index);
                }
                // Refocus the textarea after re-render
                setTimeout(() => {
                    const newTextarea = document.querySelector(`.paragraph-text[data-index="${index}"]`);
                    if (newTextarea) {
                        newTextarea.focus();
                        // Restore cursor position
                        newTextarea.setSelectionRange(textarea.selectionStart, textarea.selectionEnd);
                    }
                }, 10);
            }

            // Alt+Up = move paragraph up, Alt+Down = move paragraph down
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const newIndex = e.key === 'ArrowUp' ? index - 1 : index + 1;
                if (newIndex >= 0 && newIndex < paragraphs.length) {
                    reorderParagraph(index, newIndex);
                    // Refocus after move
                    setTimeout(() => {
                        const newTextarea = document.querySelector(`.paragraph-text[data-index="${newIndex}"]`);
                        if (newTextarea) newTextarea.focus();
                    }, 10);
                }
            }
        });
    });
}

/**
 * Reorder paragraph from one index to another
 * Validates that the move maintains a valid hierarchy
 */
function reorderParagraph(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const movingPara = paragraphs[fromIndex];
    const movingLevel = movingPara.level || 0;

    // Simulate the move to check validity
    const tempParagraphs = [...paragraphs];
    const item = tempParagraphs.splice(fromIndex, 1)[0];
    const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    tempParagraphs.splice(insertIndex, 0, item);

    // Check if this creates a valid hierarchy
    // Rule: Can't place a lower-level para between two higher-level paras
    // e.g., can't put level 0 between two level 5s
    const prevPara = insertIndex > 0 ? tempParagraphs[insertIndex - 1] : null;
    const nextPara = insertIndex < tempParagraphs.length - 1 ? tempParagraphs[insertIndex + 1] : null;

    if (prevPara && nextPara) {
        const prevLevel = prevPara.level || 0;
        const nextLevel = nextPara.level || 0;
        const minNeighborLevel = Math.min(prevLevel, nextLevel);

        if (movingLevel < minNeighborLevel) {
            showStatus(`Cannot place Level ${movingLevel + 1} between Level ${prevLevel + 1} and Level ${nextLevel + 1}`, 'error');
            return;
        }
    }

    // Valid move - apply it
    const actualItem = paragraphs.splice(fromIndex, 1)[0];
    const actualInsertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
    paragraphs.splice(actualInsertIndex, 0, actualItem);

    renderParagraphs();
    updatePreview();
}

/**
 * Get body text from paragraphs (for LaTeX generation)
 * Generates proper indentation and hierarchical numbering per SECNAV M-5216.5
 */
function getBodyText() {
    const labels = calculateParagraphLabels();

    return paragraphs.map((para, index) => {
        const level = para.level || 0;
        const indent = ' '.repeat(level * PARAGRAPH_INDENT_SPACES);
        const label = labels[index];

        // Format: indent + label + two spaces + text
        return `${indent}${label}  ${para.text}`;
    }).join('\n\n');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Initialize drag and drop for enclosure upload
 */
function initDragDrop() {
    const dropZone = document.getElementById('enclDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        for (const file of files) {
            if (file.type === 'application/pdf') {
                const title = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
                addEnclosure(title, file);
            }
        }
    });
}

// =============================================================================
// DATA COLLECTION
// =============================================================================

/**
 * Collect all form data into an object
 */
function collectData() {
    return {
        docType: document.getElementById('docType').value,
        // Font options
        fontSize: document.getElementById('fontSize').value,
        fontFamily: document.getElementById('fontFamily').value,
        pageNumberStyle: document.getElementById('pageNumberStyle').value,
        // Letterhead
        unitLine1: document.getElementById('unitLine1').value,
        unitLine2: document.getElementById('unitLine2').value,
        unitAddress: document.getElementById('unitAddress').value,
        inReplyTo: document.getElementById('inReplyTo').checked,
        ssic: document.getElementById('ssic').value,
        serial: document.getElementById('serial').value,
        date: document.getElementById('date').value,
        from: document.getElementById('from').value,
        to: document.getElementById('to').value,
        via: document.getElementById('via').value,
        subject: document.getElementById('subject').value,
        // Classification
        classLevel: document.getElementById('classLevel').value,
        cuiControlledBy: document.getElementById('cuiControlledBy').value,
        cuiCategory: document.getElementById('cuiCategory').value,
        cuiDissemination: document.getElementById('cuiDissemination').value,
        cuiDistStatement: document.getElementById('cuiDistStatement').value,
        pocEmail: document.getElementById('pocEmail').value,
        classifiedBy: document.getElementById('classifiedBy').value,
        derivedFrom: document.getElementById('derivedFrom').value,
        classReason: document.getElementById('classReason').value,
        declassifyOn: document.getElementById('declassifyOn').value,
        classifiedPocEmail: document.getElementById('classifiedPocEmail').value,
        // Body (from paragraphs array)
        body: getBodyText(),
        // Standard signature
        sigFirst: document.getElementById('sigFirst').value,
        sigMiddle: document.getElementById('sigMiddle').value,
        sigLast: document.getElementById('sigLast').value,
        sigRank: document.getElementById('sigRank').value,
        sigTitle: document.getElementById('sigTitle').value,
        // By direction
        byDirection: document.getElementById('byDirection').checked,
        byDirectionAuthority: document.getElementById('byDirectionAuthority').value,
        // MOA/MOU fields
        seniorCommandName: document.getElementById('seniorCommandName').value,
        seniorSSIC: document.getElementById('seniorSSIC').value,
        seniorSerial: document.getElementById('seniorSerial').value,
        seniorDate: document.getElementById('seniorDate').value,
        juniorCommandName: document.getElementById('juniorCommandName').value,
        juniorSSIC: document.getElementById('juniorSSIC').value,
        juniorSerial: document.getElementById('juniorSerial').value,
        juniorDate: document.getElementById('juniorDate').value,
        moaSubject: document.getElementById('moaSubject').value,
        seniorSigName: document.getElementById('seniorSigName').value,
        seniorSigRank: document.getElementById('seniorSigRank').value,
        seniorSigTitle: document.getElementById('seniorSigTitle').value,
        juniorSigName: document.getElementById('juniorSigName').value,
        juniorSigRank: document.getElementById('juniorSigRank').value,
        juniorSigTitle: document.getElementById('juniorSigTitle').value,
        // Joint Letter/Memo fields
        jointSeniorName: document.getElementById('jointSeniorName').value,
        jointSeniorCode: document.getElementById('jointSeniorCode').value,
        jointSeniorZip: document.getElementById('jointSeniorZip').value,
        jointSeniorFrom: document.getElementById('jointSeniorFrom').value,
        jointJuniorName: document.getElementById('jointJuniorName').value,
        jointJuniorCode: document.getElementById('jointJuniorCode').value,
        jointJuniorZip: document.getElementById('jointJuniorZip').value,
        jointJuniorSSIC: document.getElementById('jointJuniorSSIC').value,
        jointJuniorSerial: document.getElementById('jointJuniorSerial').value,
        jointJuniorDate: document.getElementById('jointJuniorDate').value,
        jointJuniorFrom: document.getElementById('jointJuniorFrom').value,
        jointCommonLocation: document.getElementById('jointCommonLocation').value,
        jointTo: document.getElementById('jointTo').value,
        jointSubject: document.getElementById('jointSubject').value,
        jointSeniorSigName: document.getElementById('jointSeniorSigName').value,
        jointSeniorSigTitle: document.getElementById('jointSeniorSigTitle').value,
        jointJuniorSigName: document.getElementById('jointJuniorSigName').value,
        jointJuniorSigTitle: document.getElementById('jointJuniorSigTitle').value
    };
}

/**
 * Show/hide classification fields based on selection
 */
function updateClassFields() {
    const classLevel = document.getElementById('classLevel').value;
    const cuiFields = document.getElementById('cuiFields');
    const classifiedFields = document.getElementById('classifiedFields');

    // Hide all first
    cuiFields.style.display = 'none';
    classifiedFields.style.display = 'none';

    // Show appropriate fields
    if (classLevel === 'cui') {
        cuiFields.style.display = 'block';
    } else if (['confidential', 'secret', 'top_secret', 'top_secret_sci'].includes(classLevel)) {
        classifiedFields.style.display = 'block';
    }
}

/**
 * Handle By direction checkbox toggle
 */
function updateByDirectionFields() {
    const checkbox = document.getElementById('byDirection');
    const authorityField = document.getElementById('byDirectionAuthority');

    if (checkbox.checked) {
        authorityField.style.display = 'block';
    } else {
        authorityField.style.display = 'none';
    }
}

// =============================================================================
// SIGNATURE FORMATTING
// =============================================================================

/**
 * Get abbreviated signature (F. M. LASTNAME)
 */
function getAbbrevSignature(data) {
    const firstInit = data.sigFirst ? data.sigFirst.charAt(0).toUpperCase() + '.' : '';
    const middleInit = data.sigMiddle ? data.sigMiddle.replace('.', '').toUpperCase() + '.' : '';
    const lastName = data.sigLast ? data.sigLast.toUpperCase() : '';
    return `${firstInit} ${middleInit} ${lastName}`.replace(/\s+/g, ' ').trim();
}

/**
 * Get full signature (First M. LASTNAME)
 */
function getFullSignature(data) {
    const lastName = data.sigLast ? data.sigLast.toUpperCase() : '';
    const middleInit = data.sigMiddle ? data.sigMiddle.replace('.', '') + '.' : '';
    return `${data.sigFirst} ${middleInit} ${lastName}`.replace(/\s+/g, ' ').trim();
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Parse references from textarea (format: "a | Title")
 */
function parseRefs(refsText) {
    if (!refsText.trim()) return [];
    return refsText.trim().split('\n').map(line => {
        const parts = line.split('|').map(p => p.trim());
        return { letter: parts[0] || '', title: parts[1] || '' };
    }).filter(r => r.letter && r.title);
}

// =============================================================================
// LIVE PREVIEW
// =============================================================================

/**
 * Update the live preview panel
 */
function updatePreview() {
    const data = collectData();
    const config = docTypeConfig[data.docType] || docTypeConfig.naval_letter;

    // Classification banners (top and bottom)
    const bannerTop = document.getElementById('prev-class-banner-top');
    const bannerBottom = document.getElementById('prev-class-banner-bottom');
    const cuiBlock = document.getElementById('prev-cui-block');
    const classifiedBlock = document.getElementById('prev-classified-block');

    // Reset all classification elements
    bannerTop.style.display = 'none';
    bannerBottom.style.display = 'none';
    cuiBlock.style.display = 'none';
    classifiedBlock.style.display = 'none';
    bannerTop.className = 'class-banner';
    bannerBottom.className = 'class-banner class-banner-bottom';

    if (data.classLevel === 'cui') {
        // CUI marking
        bannerTop.style.display = 'block';
        bannerBottom.style.display = 'block';
        bannerTop.textContent = 'CUI';
        bannerBottom.textContent = 'CUI';
        bannerTop.classList.add('cui');
        bannerBottom.classList.add('cui');
        // CUI designation block
        cuiBlock.style.display = 'block';
        document.getElementById('prev-cui-controlled').textContent = data.cuiControlledBy;
        document.getElementById('prev-cui-category').textContent = data.cuiCategory;
        document.getElementById('prev-cui-dissem').textContent = data.cuiDissemination;
        document.getElementById('prev-cui-poc').textContent = data.pocEmail;
        document.getElementById('prev-cui-dist').textContent = data.cuiDistStatement;
    } else if (data.classLevel === 'confidential') {
        bannerTop.style.display = 'block';
        bannerBottom.style.display = 'block';
        bannerTop.textContent = 'CONFIDENTIAL';
        bannerBottom.textContent = 'CONFIDENTIAL';
        bannerTop.classList.add('confidential');
        bannerBottom.classList.add('confidential');
        classifiedBlock.style.display = 'block';
        document.getElementById('prev-class-by').textContent = data.classifiedBy;
        document.getElementById('prev-derived-from').textContent = data.derivedFrom;
        document.getElementById('prev-class-reason').textContent = data.classReason;
        document.getElementById('prev-declassify-on').textContent = data.declassifyOn;
        document.getElementById('prev-class-poc').textContent = data.classifiedPocEmail;
    } else if (data.classLevel === 'secret') {
        bannerTop.style.display = 'block';
        bannerBottom.style.display = 'block';
        bannerTop.textContent = 'SECRET';
        bannerBottom.textContent = 'SECRET';
        bannerTop.classList.add('secret');
        bannerBottom.classList.add('secret');
        classifiedBlock.style.display = 'block';
        document.getElementById('prev-class-by').textContent = data.classifiedBy;
        document.getElementById('prev-derived-from').textContent = data.derivedFrom;
        document.getElementById('prev-class-reason').textContent = data.classReason;
        document.getElementById('prev-declassify-on').textContent = data.declassifyOn;
        document.getElementById('prev-class-poc').textContent = data.classifiedPocEmail;
    } else if (data.classLevel === 'top_secret') {
        bannerTop.style.display = 'block';
        bannerBottom.style.display = 'block';
        bannerTop.textContent = 'TOP SECRET';
        bannerBottom.textContent = 'TOP SECRET';
        bannerTop.classList.add('top-secret');
        bannerBottom.classList.add('top-secret');
        classifiedBlock.style.display = 'block';
        document.getElementById('prev-class-by').textContent = data.classifiedBy;
        document.getElementById('prev-derived-from').textContent = data.derivedFrom;
        document.getElementById('prev-class-reason').textContent = data.classReason;
        document.getElementById('prev-declassify-on').textContent = data.declassifyOn;
        document.getElementById('prev-class-poc').textContent = data.classifiedPocEmail;
    } else if (data.classLevel === 'top_secret_sci') {
        bannerTop.style.display = 'block';
        bannerBottom.style.display = 'block';
        bannerTop.textContent = 'TOP SECRET//SCI';
        bannerBottom.textContent = 'TOP SECRET//SCI';
        bannerTop.classList.add('top-secret-sci');
        bannerBottom.classList.add('top-secret-sci');
        classifiedBlock.style.display = 'block';
        document.getElementById('prev-class-by').textContent = data.classifiedBy;
        document.getElementById('prev-derived-from').textContent = data.derivedFrom;
        document.getElementById('prev-class-reason').textContent = data.classReason;
        document.getElementById('prev-declassify-on').textContent = data.declassifyOn;
        document.getElementById('prev-class-poc').textContent = data.classifiedPocEmail;
    }

    // Letterhead
    const letterhead = document.getElementById('prev-letterhead');
    if (config.letterhead) {
        letterhead.style.display = 'block';
        document.getElementById('prev-unit1').textContent = data.unitLine1;
        document.getElementById('prev-unit2').textContent = data.unitLine2;
        document.getElementById('prev-address').textContent = data.unitAddress;
    } else {
        letterhead.style.display = 'none';
    }

    // Memo header
    const memoHeader = document.getElementById('prev-memo-header');
    if (config.memoHeader) {
        memoHeader.style.display = 'block';
        memoHeader.textContent = config.memoHeader;
    } else {
        memoHeader.style.display = 'none';
    }

    // In Reply Refer To (per SECNAV M-5216.5 App C, Para 1.a)
    const inReplyBlock = document.getElementById('prev-in-reply');
    if (data.inReplyTo && config.ssic) {
        inReplyBlock.style.display = 'block';
    } else {
        inReplyBlock.style.display = 'none';
    }

    // SSIC block
    const ssicBlock = document.getElementById('prev-ssic-block');
    if (config.ssic) {
        ssicBlock.style.display = 'block';
        document.getElementById('prev-ssic').textContent = data.ssic;
        document.getElementById('prev-serial').textContent = data.serial;
        document.getElementById('prev-date').textContent = data.date;
    } else {
        ssicBlock.style.display = 'none';
    }

    // Date only (for memos without SSIC)
    const dateOnly = document.getElementById('prev-date-only');
    if (!config.ssic && !config.business) {
        dateOnly.style.display = 'block';
        dateOnly.textContent = data.date;
    } else {
        dateOnly.style.display = 'none';
    }

    // From/To block
    const fromBlock = document.getElementById('prev-from-block');
    const toBlock = document.getElementById('prev-to-block');
    if (config.fromTo) {
        fromBlock.style.display = 'block';
        toBlock.style.display = 'block';
        document.getElementById('prev-from').textContent = data.from;
        document.getElementById('prev-to').textContent = data.to;
    } else if (config.memoFor) {
        fromBlock.style.display = 'none';
        toBlock.style.display = 'block';
        document.getElementById('prev-to').textContent = data.to;
    } else {
        fromBlock.style.display = 'none';
        toBlock.style.display = 'none';
    }

    // Via
    const viaBlock = document.getElementById('prev-via-block');
    if (config.via && data.via.trim()) {
        viaBlock.style.display = 'block';
        document.getElementById('prev-via').innerHTML = data.via.split('\n').join('<br>');
    } else {
        viaBlock.style.display = 'none';
    }

    // Subject
    document.getElementById('prev-subject').textContent = data.subject.toUpperCase();

    // References (using global references array)
    const refBlock = document.getElementById('prev-ref-block');
    if (references.length > 0) {
        refBlock.style.display = 'block';
        document.getElementById('prev-refs').innerHTML = references.map(r => `(${r.letter}) ${r.title}`).join('<br>');
    } else {
        refBlock.style.display = 'none';
    }

    // Enclosures (using global enclosures array)
    const enclBlock = document.getElementById('prev-encl-block');
    if (enclosures.length > 0) {
        enclBlock.style.display = 'block';
        document.getElementById('prev-encls').innerHTML = enclosures.map((e, i) => `(${i + 1}) ${e.title || 'Untitled'}`).join('<br>');
    } else {
        enclBlock.style.display = 'none';
    }

    // Body
    document.getElementById('prev-body').textContent = data.body;

    // Signature
    if (config.signature === 'full') {
        document.getElementById('prev-sig').innerHTML = `${getFullSignature(data)}<br>${data.sigRank}<br>${data.sigTitle}`;
    } else {
        document.getElementById('prev-sig').textContent = getAbbrevSignature(data);
    }

    // Copy To (Distribution)
    const copyToBlock = document.getElementById('prev-copyto-block');
    if (copyTos.length > 0) {
        copyToBlock.style.display = 'block';
        document.getElementById('prev-copytos').innerHTML = copyTos.map(ct => ct.text).join('<br>');
    } else {
        copyToBlock.style.display = 'none';
    }

    // Schedule PDF preview update (debounced)
    if (engineReady) {
        schedulePdfPreviewUpdate();
    }
}

// =============================================================================
// LATEX GENERATION
// =============================================================================

/**
 * Escape LaTeX special characters
 */
function escapeLatex(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Generate config/document.tex
 */
function generateDocumentTex(data) {
    const config = docTypeConfig[data.docType] || docTypeConfig.naval_letter;
    const uiMode = config.uiMode || 'standard';

    let tex = `%=============================================================================
% DOCUMENT CONFIGURATION - Generated by libo-secured
%=============================================================================

\\setDocumentType{${data.docType}}

% Font and page options
\\setFontSize{${data.fontSize || '12pt'}}
\\setFontFamily{${data.fontFamily || 'courier'}}
\\setPageNumberStyle{${data.pageNumberStyle || 'xofy'}}

${data.inReplyTo ? '\\enableInReplyReferTo' : '% \\enableInReplyReferTo'}

`;

    // MOA/MOU specific configuration
    if (uiMode === 'moa') {
        tex += `% MOA/MOU Configuration
\\setSeniorCommand{${escapeLatex(data.seniorCommandName)}}
\\setSSIC{${escapeLatex(data.seniorSSIC)}}
\\setSerial{${escapeLatex(data.seniorSerial)}}
\\setDocumentDate{${escapeLatex(data.seniorDate)}}

\\setJuniorCommand
    {${escapeLatex(data.juniorCommandName)}}
    {${escapeLatex(data.juniorSSIC)}}
    {${escapeLatex(data.juniorSerial)}}
    {${escapeLatex(data.juniorDate)}}
    {${escapeLatex(data.juniorSigName)}}
    {${escapeLatex(data.juniorSigRank)}}
    {${escapeLatex(data.juniorSigTitle)}}

\\setSubject{${escapeLatex(data.moaSubject)}}

\\setBusinessSalutation{Dear Sir or Madam:}
\\setBusinessClose{Very respectfully,}

\\setPOC{${escapeLatex(data.pocEmail)}}
`;
    }
    // Joint Letter/Memo specific configuration
    else if (uiMode === 'joint') {
        tex += `% Joint Letter/Memo Configuration
\\setSeniorCommand
    {${escapeLatex(data.jointSeniorName)}}
    {${escapeLatex(data.jointSeniorZip)}}
    {${escapeLatex(data.jointSeniorCode)}}
    {${escapeLatex(data.jointSeniorFrom)}}

\\setSSIC{${escapeLatex(data.ssic)}}
\\setSerial{${escapeLatex(data.serial)}}
\\setDocumentDate{${escapeLatex(data.date)}}

\\setJuniorCommand
    {${escapeLatex(data.jointJuniorName)}}
    {${escapeLatex(data.jointJuniorZip)}}
    {${escapeLatex(data.jointJuniorCode)}}
    {${escapeLatex(data.jointJuniorSSIC)}}
    {${escapeLatex(data.jointJuniorSerial)}}
    {${escapeLatex(data.jointJuniorDate)}}
    {${escapeLatex(data.jointJuniorSigName)}}
    {${escapeLatex(data.jointJuniorSigTitle)}}
    {${escapeLatex(data.jointJuniorFrom)}}

\\setCommonLocation{${escapeLatex(data.jointCommonLocation)}}

\\setTo
    {${escapeLatex(data.jointTo)}}
    {}{}{}

\\setSubject{${escapeLatex(data.jointSubject)}}

\\setBusinessSalutation{Dear Sir or Madam:}
\\setBusinessClose{Very respectfully,}

\\setPOC{${escapeLatex(data.pocEmail)}}
`;
    }
    // Standard configuration
    else {
        tex += `\\setSSIC{${escapeLatex(data.ssic)}}
\\setSerial{${escapeLatex(data.serial)}}
\\setDocumentDate{${escapeLatex(data.date)}}

\\setFrom
    {${escapeLatex(data.from)}}
    {}{}{}

\\setTo
    {${escapeLatex(data.to)}}
    {}{}{}

${data.via.trim() ? `\\setVia
    {${escapeLatex(data.via.split('\n')[0] || '')}}
    {${escapeLatex(data.via.split('\n')[1] || '')}}
    {${escapeLatex(data.via.split('\n')[2] || '')}}
    {${escapeLatex(data.via.split('\n')[3] || '')}}` : '% No Via'}

\\setSubject{${escapeLatex(data.subject)}}

\\setBusinessSalutation{Dear Sir or Madam:}
\\setBusinessClose{Very respectfully,}

\\setPOC{${escapeLatex(data.pocEmail)}}
`;
    }

    return tex;
}

/**
 * Generate config/letterhead.tex
 */
function generateLetterheadTex(data) {
    return `%=============================================================================
% LETTERHEAD CONFIGURATION - Generated by libo-secured
%=============================================================================

\\setLetterhead
    {${escapeLatex(data.unitLine1)}}
    {${escapeLatex(data.unitLine2)}}
    {${escapeLatex(data.unitAddress.split(',')[0] || '')}}
    {${escapeLatex(data.unitAddress.split(',').slice(1).join(',').trim() || '')}}
`;
}

/**
 * Generate config/signatory.tex
 */
function generateSignatoryTex(data) {
    const config = docTypeConfig[data.docType] || docTypeConfig.naval_letter;
    const uiMode = config.uiMode || 'standard';

    // For MOA/MOU, use the senior signatory fields
    if (uiMode === 'moa') {
        return `%=============================================================================
% SIGNATURE CONFIGURATION - Generated by libo-secured (MOA/MOU)
%=============================================================================

% Senior command signatory (signs last)
\\setSignatoryName{${escapeLatex(data.seniorSigName)}}
\\setSignatoryAbbrev{${escapeLatex(data.seniorSigName.toUpperCase())}}
\\renewcommand{\\SignatoryRank}{${escapeLatex(data.seniorSigRank)}}
\\renewcommand{\\SignatoryTitle}{${escapeLatex(data.seniorSigTitle)}}

\\setSignatureImage{}
`;
    }

    // For Joint Letter/Memo, use joint signatory fields
    if (uiMode === 'joint') {
        return `%=============================================================================
% SIGNATURE CONFIGURATION - Generated by libo-secured (Joint)
%=============================================================================

% Senior command signatory (signs last)
\\setSignatoryName{${escapeLatex(data.jointSeniorSigName)}}
\\setSignatoryAbbrev{${escapeLatex(data.jointSeniorSigName.toUpperCase())}}
\\renewcommand{\\SignatoryTitle}{${escapeLatex(data.jointSeniorSigTitle)}}

\\setSignatureImage{}
`;
    }

    // Standard signature
    const fullName = getFullSignature(data);
    const abbrevName = getAbbrevSignature(data);

    // Build By direction line
    let byDirectionTex = '';
    if (data.byDirection) {
        const authority = data.byDirectionAuthority || 'the Commanding Officer';
        byDirectionTex = `\\setByDirection{By direction of ${escapeLatex(authority)}}`;
    }

    return `%=============================================================================
% SIGNATURE CONFIGURATION - Generated by libo-secured
%=============================================================================

\\setSignatory
    {${escapeLatex(data.sigFirst)}}
    {${escapeLatex(data.sigMiddle)}}
    {${escapeLatex(data.sigLast)}}
    {${escapeLatex(data.sigRank)}}
    {${escapeLatex(data.sigTitle)}}

\\setSignatoryName{${escapeLatex(fullName)}}
\\setSignatoryAbbrev{${escapeLatex(abbrevName)}}

${byDirectionTex}

\\setSignatureImage{}
`;
}

/**
 * Generate flags.tex (tells LaTeX whether references/enclosures exist)
 * This is loaded in the preamble before the content files
 */
function generateFlagsTex() {
    let flags = '% Flags - Generated by libo-secured\n';
    if (references.length > 0) {
        flags += '\\setHasReferences\n';
    }
    if (enclosures.length > 0) {
        flags += '\\setHasEnclosures\n';
    }
    return flags;
}

/**
 * Generate config/references.tex (uses global references array)
 */
function generateReferencesTex() {
    console.log('generateReferencesTex called, references:', references);
    if (references.length === 0) {
        console.log('No references, returning empty');
        return '% No references\n';
    }
    const tex = `%=============================================================================
% REFERENCES - Generated by libo-secured
%=============================================================================

${references.map(r => `\\refitem{${r.letter}}{${escapeLatex(r.title)}}`).join('\n')}
`;
    console.log('Generated references.tex:', tex);
    return tex;
}

/**
 * Generate config/reference-urls.tex (uses global references array)
 */
function generateReferenceUrlsTex() {
    const refsWithUrls = references.filter(r => r.url && r.url.trim());
    if (refsWithUrls.length === 0) return '% No reference URLs\n';
    return `%=============================================================================
% REFERENCE URLS - Generated by libo-secured
%=============================================================================

${refsWithUrls.map(r => `\\setRefURL{${r.letter}}{${escapeLatexUrl(r.url)}}`).join('\n')}
`;
}

/**
 * Escape URL for LaTeX (handle % and other special chars)
 */
function escapeLatexUrl(url) {
    if (!url) return '';
    return url
        .replace(/%/g, '\\%')
        .replace(/#/g, '\\#')
        .replace(/&/g, '\\&');
}

/**
 * Generate config/enclosures.tex (uses global enclosures array)
 *
 * Strategy for handling enclosures:
 * - Text-only enclosures: Pass empty filename, LaTeX creates placeholder page
 * - PDF enclosures: Pass special marker "JSPDF", LaTeX skips placeholder (JS appends actual PDF)
 *
 * This ensures:
 * 1. Text-only enclosures show up in the enclosure list AND get placeholder pages
 * 2. PDF enclosures show up in the enclosure list but NO placeholder (JS appends them)
 */
function generateEnclosuresTex() {
    console.log('generateEnclosuresTex called');
    console.log('  enclosures.length:', enclosures.length);
    console.log('  enclosures:', JSON.stringify(enclosures, null, 2));
    if (enclosures.length === 0) {
        console.log('No enclosures, returning empty');
        return '% No enclosures - ' + Date.now() + '\n';
    }
    const tex = `%=============================================================================
% ENCLOSURES - Generated by libo-secured at ${new Date().toISOString()}
% Count: ${enclosures.length} enclosures
% Note: PDF files are merged by JavaScript (SwiftLaTeX doesn't support \\includepdf)
%=============================================================================

${enclosures.map((e, i) => {
    // For enclosures with PDF files attached, use special marker "JSPDF"
    // LaTeX will recognize this and NOT create a placeholder page
    // JS will append the actual PDF pages later
    const filename = (e.file && e.file.data) ? 'JSPDF' : '';
    const line = `\\enclosure{${i + 1}}{${filename}}{${escapeLatex(e.title || 'Untitled')}}`;
    console.log('  enclosure line:', line);
    return line;
}).join('\n')}
`;
    console.log('Generated enclosures.tex:', tex);
    return tex;
}

/**
 * Generate copyto-config.tex with copy-to recipients
 */
function generateCopyToTex() {
    if (copyTos.length === 0) {
        return '% No copy-to recipients\n';
    }

    return `%=============================================================================
% COPY TO (DISTRIBUTION) - Generated by libo-secured
% Count: ${copyTos.length} recipients
%=============================================================================

\\setHasCopyTo
${copyTos.map((ct, i) => `\\copytoentry{${i + 1}}{${escapeLatex(ct.text)}}`).join('\n')}
`;
}

/**
 * Generate config/body.tex with proper hierarchical paragraph structure
 * Uses LaTeX environments for sub-paragraphs per SECNAV M-5216.5
 */
function generateBodyTex(data) {
    // Parse the body text back into structured paragraphs with levels
    // Format from getBodyText(): "1.  text" or "    a.  text" etc.
    const lines = data.body.split('\n\n').filter(p => p.trim());

    let latex = `%=============================================================================
% DOCUMENT BODY - Generated by libo-secured
%=============================================================================

`;

    // Track open environments to close them properly
    let openLevels = []; // Stack of open environment levels

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Detect level from leading spaces (4 spaces per level)
        const leadingSpaces = line.match(/^(\s*)/)[1].length;
        const level = Math.floor(leadingSpaces / PARAGRAPH_INDENT_SPACES);

        // Extract the text after the label
        // Labels can be: 1. or a. or (1) or (a)
        const textMatch = trimmed.match(/^(?:\d+\.|[a-z]\.|\(\d+\)|\([a-z]\))\s+(.*)$/s);
        const text = textMatch ? textMatch[1] : trimmed;

        // Close current environment if level changes (don't nest - each level is independent)
        if (openLevels.length > 0 && openLevels[openLevels.length - 1] !== level) {
            const closingLevel = openLevels.pop();
            latex += getCloseEnvironment(closingLevel) + '\n\n';
        }

        // Generate appropriate LaTeX based on level
        if (level === 0) {
            // Top-level paragraph: output the full line (label + text) since level 0 isn't in an environment
            // The label is already included in trimmed, e.g. "1. paragraph text here"
            latex += `\\vspace{12pt}\n\\noindent ${escapeLatex(trimmed)}\n\n`;
        } else {
            // Sub-paragraph: open environment if not already open at this level
            if (openLevels.length === 0) {
                latex += getOpenEnvironment(level) + '\n';
                openLevels.push(level);
            }
            latex += `\\item ${escapeLatex(text)}\n\n`;
        }
    }

    // Close any remaining open environments
    while (openLevels.length > 0) {
        const closingLevel = openLevels.pop();
        latex += getCloseEnvironment(closingLevel) + '\n';
    }

    return latex;
}

/**
 * Get LaTeX environment opener for a given level
 */
function getOpenEnvironment(level) {
    switch (level) {
        case 1: return '\\begin{subpara}';           // a., b., c.
        case 2: return '\\begin{subsubpara}';        // (1), (2), (3)
        case 3: return '\\begin{subsubsubpara}';     // (a), (b), (c)
        case 4: return '\\begin{subsubsubsubpara}';  // 1., 2., 3.
        case 5: return '\\begin{subsubsubsubsubpara}';     // a., b., c.
        case 6: return '\\begin{subsubsubsubsubsubpara}';  // (1), (2), (3)
        case 7: return '\\begin{subsubsubsubsubsubsubpara}'; // (a), (b), (c)
        default: return '\\begin{enumerate}';
    }
}

/**
 * Get LaTeX environment closer for a given level
 */
function getCloseEnvironment(level) {
    switch (level) {
        case 1: return '\\end{subpara}';
        case 2: return '\\end{subsubpara}';
        case 3: return '\\end{subsubsubpara}';
        case 4: return '\\end{subsubsubsubpara}';
        case 5: return '\\end{subsubsubsubsubpara}';
        case 6: return '\\end{subsubsubsubsubsubpara}';
        case 7: return '\\end{subsubsubsubsubsubsubpara}';
        default: return '\\end{enumerate}';
    }
}

/**
 * Generate config/classification.tex
 */
function generateClassificationTex(data) {
    if (data.classLevel === 'unclassified') {
        return `%=============================================================================
% CLASSIFICATION CONFIGURATION - Generated by libo-secured
%=============================================================================
% Document is UNCLASSIFIED - no markings required
`;
    }

    if (data.classLevel === 'cui') {
        return `%=============================================================================
% CLASSIFICATION CONFIGURATION - Generated by libo-secured
%=============================================================================
% CUI Configuration per DoDI 5200.48

\\setClassification{CUI}
\\setCUIControlledBy{${escapeLatex(data.cuiControlledBy)}}
\\setCUICategory{${escapeLatex(data.cuiCategory)}}
\\setCUIDissemination{${escapeLatex(data.cuiDissemination)}}
\\setCUIDistStatement{${escapeLatex(data.cuiDistStatement)}}
\\setPOC{${escapeLatex(data.pocEmail)}}
`;
    }

    // Classified documents
    const classLevelMap = {
        'confidential': 'CONFIDENTIAL',
        'secret': 'SECRET',
        'top_secret': 'TOP SECRET',
        'top_secret_sci': 'TOP SECRET//SCI'
    };

    return `%=============================================================================
% CLASSIFICATION CONFIGURATION - Generated by libo-secured
%=============================================================================
% WARNING: Only process classified documents on systems authorized
% for that classification level.

\\setClassification{${classLevelMap[data.classLevel] || 'SECRET'}}
\\setClassifiedBy{${escapeLatex(data.classifiedBy)}}
\\setDerivedFrom{${escapeLatex(data.derivedFrom)}}
\\setDeclassifyOn{${escapeLatex(data.declassifyOn)}}
\\setClassificationReason{${escapeLatex(data.classReason)}}
\\setPOC{${escapeLatex(data.classifiedPocEmail)}}
`;
}

// =============================================================================
// DOWNLOAD FUNCTIONS
// =============================================================================

/**
 * Download all config files as ZIP
 */
async function downloadConfigs() {
    const data = collectData();
    const zip = new JSZip();

    // Add config files
    const configFolder = zip.folder('config');
    configFolder.file('document.tex', generateDocumentTex(data));
    configFolder.file('letterhead.tex', generateLetterheadTex(data));
    configFolder.file('signatory.tex', generateSignatoryTex(data));
    configFolder.file('references.tex', generateReferencesTex());
    configFolder.file('reference-urls.tex', generateReferenceUrlsTex());
    configFolder.file('enclosures.tex', generateEnclosuresTex());
    configFolder.file('body.tex', generateBodyTex(data));
    configFolder.file('classification.tex', generateClassificationTex(data));

    // Add enclosure PDF files
    const enclosuresWithFiles = enclosures.filter(e => e.file && e.file.data);
    if (enclosuresWithFiles.length > 0) {
        const enclosuresFolder = zip.folder('enclosures');
        for (const encl of enclosuresWithFiles) {
            enclosuresFolder.file(encl.file.name, encl.file.data);
        }
    }

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'libo-secured-config.zip';
    a.click();
    URL.revokeObjectURL(url);

    showStatus('Config files downloaded! Extract to your libo-secured folder and run: make build', 'success');
}

/**
 * Quick PDF using jsPDF with pdf-lib for merging enclosures
 */
async function downloadPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const { PDFDocument } = PDFLib;
        const data = collectData();
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

        let y = MARGIN_TOP;

        // Letterhead
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(0, 40, 85);
        pdf.text('UNITED STATES MARINE CORPS', PAGE_WIDTH / 2, y, { align: 'center' });
        y += 14;
        pdf.setFontSize(9);
        pdf.text(data.unitLine1, PAGE_WIDTH / 2, y, { align: 'center' });
        y += 11;
        pdf.setFont('helvetica', 'normal');
        pdf.text(data.unitLine2, PAGE_WIDTH / 2, y, { align: 'center' });
        y += 11;
        pdf.setFontSize(8);
        pdf.text(data.unitAddress, PAGE_WIDTH / 2, y, { align: 'center' });
        y += 36;

        // SSIC block
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        const rightX = PAGE_WIDTH - MARGIN_RIGHT;
        pdf.text(data.ssic, rightX, y, { align: 'right' });
        y += 14;
        pdf.text(data.serial, rightX, y, { align: 'right' });
        y += 14;
        pdf.text(data.date, rightX, y, { align: 'right' });
        y += 28;

        // From/To
        pdf.text('From:  ' + data.from, MARGIN_LEFT, y);
        y += 14;
        pdf.text('To:    ' + data.to, MARGIN_LEFT, y);
        y += 14;

        // Via
        if (data.via.trim()) {
            data.via.split('\n').forEach((line, i) => {
                pdf.text((i === 0 ? 'Via:   ' : '       ') + line.trim(), MARGIN_LEFT, y);
                y += 14;
            });
        }
        y += 14;

        // Subject
        pdf.text('Subj:  ' + data.subject.toUpperCase(), MARGIN_LEFT, y);
        y += 14;

        // Refs (using global references array)
        if (references.length > 0) {
            references.forEach((r, i) => {
                pdf.text((i === 0 ? 'Ref:   ' : '       ') + `(${r.letter}) ${r.title}`, MARGIN_LEFT, y);
                y += 14;
            });
        }

        // Encls (using global enclosures array)
        if (enclosures.length > 0) {
            enclosures.forEach((e, i) => {
                pdf.text((i === 0 ? 'Encl:   ' : '        ') + `(${i + 1}) ${e.title || 'Untitled'}`, MARGIN_LEFT, y);
                y += 14;
            });
        }
        y += 14;

        // Body
        const bodyLines = data.body.split('\n');
        for (const line of bodyLines) {
            const wrappedLines = pdf.splitTextToSize(line, CONTENT_WIDTH);
            for (const wrappedLine of wrappedLines) {
                if (y > PAGE_HEIGHT - MARGIN_BOTTOM - 72) {
                    pdf.addPage();
                    y = MARGIN_TOP;
                }
                pdf.text(wrappedLine, MARGIN_LEFT, y);
                y += 14;
            }
            y += 4;
        }

        // Signature
        y += 28;
        if (y > PAGE_HEIGHT - MARGIN_BOTTOM - 36) {
            pdf.addPage();
            y = MARGIN_TOP + 72;
        }
        pdf.text(getAbbrevSignature(data), PAGE_WIDTH / 2 + 36, y);

        // Get enclosures with attached PDF files
        const enclosuresWithFiles = enclosures.filter(e => e.file && e.file.data);

        if (enclosuresWithFiles.length > 0) {
            // Use pdf-lib to merge main document with enclosure PDFs
            showStatus('Merging enclosure PDFs...', 'success');

            // Get main document as ArrayBuffer
            const mainPdfBytes = pdf.output('arraybuffer');

            // Create merged PDF
            const mergedPdf = await PDFDocument.create();

            // Load and copy main document pages
            const mainDoc = await PDFDocument.load(mainPdfBytes);
            const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
            mainPages.forEach(page => mergedPdf.addPage(page));

            // Append each enclosure PDF
            for (const encl of enclosuresWithFiles) {
                try {
                    const enclDoc = await PDFDocument.load(encl.file.data);
                    const enclPages = await mergedPdf.copyPages(enclDoc, enclDoc.getPageIndices());
                    enclPages.forEach(page => mergedPdf.addPage(page));
                } catch (enclError) {
                    console.warn(`Could not merge enclosure "${encl.title}":`, enclError);
                }
            }

            // Save merged PDF
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'correspondence.pdf';
            a.click();
            URL.revokeObjectURL(url);

            showStatus(`PDF downloaded with ${enclosuresWithFiles.length} enclosure(s) attached!`, 'success');
        } else {
            // No enclosure PDFs to merge, just save the main document
            pdf.save('correspondence.pdf');
            showStatus('Quick PDF downloaded!', 'success');
        }
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
}

/**
 * Download PDF compiled using SwiftLaTeX (proper LaTeX formatting)
 * Enclosure PDFs are merged by JavaScript with proper formatting overlays.
 */
async function downloadLatexPDF(retryAfterReset = false) {
    try {
        showStatus('Compiling LaTeX...', 'success');

        // Compile LaTeX document
        const pdfBytes = await compileLatex();

        // Merge enclosure PDFs
        const finalPdfBytes = await mergeEnclosurePdfs(pdfBytes);

        // Download the compiled PDF
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'correspondence.pdf';
        a.click();
        URL.revokeObjectURL(url);

        const enclCount = enclosures.filter(e => e.file && e.file.data).length;
        if (enclCount > 0) {
            showStatus(`LaTeX PDF downloaded with ${enclCount} enclosure(s)!`, 'success');
        } else {
            showStatus('LaTeX PDF downloaded!', 'success');
        }
    } catch (error) {
        console.error('LaTeX compilation error:', error);

        // Auto-recover from fatal format errors by resetting engine
        if (error.message === 'ENGINE_RESET_NEEDED' && !retryAfterReset) {
            console.log('Auto-recovering from fatal format error...');
            showStatus('Resetting engine and retrying...', 'success');
            await resetLatexEngine();
            // Retry once after reset
            return downloadLatexPDF(true);
        }

        showStatus('LaTeX compilation failed: ' + error.message, 'error');
    }
}

/**
 * Download simple .tex file
 */
function downloadTeX() {
    const data = collectData();
    const sig = getAbbrevSignature(data);

    const tex = `\\documentclass[12pt, letterpaper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{courier}
\\usepackage{xcolor}
\\renewcommand{\\familydefault}{\\ttdefault}
\\raggedright
\\setlength{\\parindent}{0pt}
\\definecolor{navyblue}{RGB}{0, 40, 85}
\\pagestyle{empty}

\\begin{document}

\\begin{center}
{\\color{navyblue}\\textbf{UNITED STATES MARINE CORPS}}\\\\[2pt]
{\\color{navyblue}\\small\\textbf{${escapeLatex(data.unitLine1)}}}\\\\[2pt]
{\\color{navyblue}\\small ${escapeLatex(data.unitLine2)}}\\\\[2pt]
{\\color{navyblue}\\scriptsize ${escapeLatex(data.unitAddress)}}
\\end{center}

\\vspace{0.5in}

\\hfill
\\begin{tabular}[t]{@{}l@{}}
${escapeLatex(data.ssic)}\\\\
${escapeLatex(data.serial)}\\\\
${escapeLatex(data.date)}
\\end{tabular}

\\vspace{0.25in}

From:  ${escapeLatex(data.from)}\\\\
To:    ${escapeLatex(data.to)}
${data.via.trim() ? '\\\\Via:   ' + data.via.split('\n').map(l => escapeLatex(l.trim())).join('\\\\\n       ') : ''}

\\vspace{0.15in}

Subj:  ${escapeLatex(data.subject.toUpperCase())}

${references.length > 0 ? '\\vspace{0.1in}\n\nRef:   ' + references.map(r => `(${r.letter}) ${escapeLatex(r.title)}`).join('\\\\\n       ') : ''}

\\vspace{0.25in}

${data.body.split('\n').map(line => escapeLatex(line)).join('\n\n')}

\\vspace{0.5in}

\\hspace{3.25in}${escapeLatex(sig)}

\\end{document}
`;

    const blob = new Blob([tex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'correspondence.tex';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('LaTeX file downloaded!', 'success');
}

/**
 * Download as Word document (.docx)
 */
async function downloadDocx() {
    showStatus('Generating Word document...', 'success');

    try {
        const data = collectData();
        const sig = getAbbrevSignature(data);

        // Get docx library from global scope
        const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber } = docx;

        // Build document sections
        const children = [];

        // Letterhead - centered
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'UNITED STATES MARINE CORPS', bold: true, size: 24 })
            ]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: data.unitLine1, bold: true, size: 20 })
            ]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
                new TextRun({ text: data.unitLine2, size: 20 })
            ]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
                new TextRun({ text: data.unitAddress.replace(/\n/g, ' '), size: 18 })
            ]
        }));

        // SSIC/Serial/Date block - right aligned
        children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: data.ssic, size: 24, font: 'Times New Roman' })]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: data.serial, size: 24, font: 'Times New Roman' })]
        }));
        children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
            children: [new TextRun({ text: data.date, size: 24, font: 'Times New Roman' })]
        }));

        // From/To
        children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'From:  ', size: 24, font: 'Times New Roman' }),
                new TextRun({ text: data.from, size: 24, font: 'Times New Roman' })
            ]
        }));
        children.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({ text: 'To:    ', size: 24, font: 'Times New Roman' }),
                new TextRun({ text: data.to, size: 24, font: 'Times New Roman' })
            ]
        }));

        // Via (if present)
        if (data.via.trim()) {
            children.push(new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: 'Via:   ', size: 24, font: 'Times New Roman' }),
                    new TextRun({ text: data.via.split('\n')[0], size: 24, font: 'Times New Roman' })
                ]
            }));
        }

        // Subject
        children.push(new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
                new TextRun({ text: 'Subj:  ', size: 24, font: 'Times New Roman' }),
                new TextRun({ text: data.subject.toUpperCase(), size: 24, font: 'Times New Roman' })
            ]
        }));

        // References
        if (references.length > 0) {
            children.push(new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: 'Ref:   ', size: 24, font: 'Times New Roman' }),
                    new TextRun({ text: `(a) ${references[0].title}`, size: 24, font: 'Times New Roman' })
                ]
            }));
            for (let i = 1; i < references.length; i++) {
                children.push(new Paragraph({
                    spacing: { after: 100 },
                    children: [
                        new TextRun({ text: `       (${references[i].letter}) ${references[i].title}`, size: 24, font: 'Times New Roman' })
                    ]
                }));
            }
        }

        // Enclosures
        if (enclosures.length > 0) {
            children.push(new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [
                    new TextRun({ text: 'Encl:  ', size: 24, font: 'Times New Roman' }),
                    new TextRun({ text: `(1) ${enclosures[0].title || 'Untitled'}`, size: 24, font: 'Times New Roman' })
                ]
            }));
            for (let i = 1; i < enclosures.length; i++) {
                children.push(new Paragraph({
                    spacing: { after: 100 },
                    children: [
                        new TextRun({ text: `       (${i + 1}) ${enclosures[i].title || 'Untitled'}`, size: 24, font: 'Times New Roman' })
                    ]
                }));
            }
        }

        // Body paragraphs with hierarchical numbering
        children.push(new Paragraph({ spacing: { before: 300 } })); // Spacing before body
        const paraLabels = calculateParagraphLabels();
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            const level = para.level || 0;
            const label = paraLabels[i];
            // DOCX uses twips for indentation (1 inch = 1440 twips, 0.5 inch = 720)
            // Each level = 4 spaces = ~0.33 inches = 480 twips
            const indentTwips = level * 480;

            children.push(new Paragraph({
                spacing: { after: 200 },
                indent: { left: indentTwips },
                children: [
                    new TextRun({ text: `${label}  ${para.text}`, size: 24, font: 'Times New Roman' })
                ]
            }));
        }

        // Signature block - centered right
        children.push(new Paragraph({ spacing: { before: 600 } })); // Space before signature
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            indent: { left: 4320 }, // 3 inches from left (in TWIPs)
            children: [
                new TextRun({ text: sig, size: 24, font: 'Times New Roman' })
            ]
        }));

        // Copy To (if present)
        if (copyTos.length > 0) {
            children.push(new Paragraph({ spacing: { before: 400 } }));
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: 'Copy to:', size: 24, font: 'Times New Roman' })
                ]
            }));
            for (const ct of copyTos) {
                children.push(new Paragraph({
                    spacing: { after: 50 },
                    children: [
                        new TextRun({ text: `    ${ct.text}`, size: 24, font: 'Times New Roman' })
                    ]
                }));
            }
        }

        // Create document
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch in TWIPs
                            bottom: 1440,
                            left: 1440,
                            right: 1440
                        }
                    }
                },
                children: children
            }]
        });

        // Generate and download
        const blob = await Packer.toBlob(doc);
        const filename = `${data.subject.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') || 'correspondence'}.docx`;
        saveAs(blob, filename);

        showStatus('Word document downloaded!', 'success');
    } catch (error) {
        console.error('Error generating DOCX:', error);
        showStatus('Error generating Word document: ' + error.message, 'error');
    }
}

// =============================================================================
// DATA LOADING
// =============================================================================

// Store SSIC data globally for search
let ssicData = [];

/**
 * Load SSIC codes from JSON and populate datalist
 */
async function loadSSICData() {
    try {
        const response = await fetch('data/ssic.json');
        const data = await response.json();
        ssicData = data.codes;
        const datalist = document.getElementById('ssic-list');

        // New format: array of {code, title} objects
        for (const item of data.codes) {
            const option = document.createElement('option');
            option.value = item.code;
            option.label = `${item.code} - ${item.title}`;
            datalist.appendChild(option);
        }
        console.log(`Loaded ${data.codes.length} SSIC codes`);
    } catch (error) {
        console.warn('Could not load SSIC data:', error);
    }
}

// Store loaded unit data globally for selectUnit function
let unitData = [];

/**
 * Load unit data from JSON and populate dropdown
 */
async function loadUnitData() {
    try {
        const response = await fetch('data/units.json');
        const data = await response.json();
        unitData = data.units;

        const select = document.getElementById('unitSelect');

        // Group units by type for easier navigation
        const typeGroups = {};
        for (const unit of data.units) {
            const type = unit.type || 'other';
            // Capitalize first letter of type
            const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
            if (!typeGroups[typeLabel]) {
                typeGroups[typeLabel] = [];
            }
            typeGroups[typeLabel].push(unit);
        }

        // Create optgroups for each type
        for (const [type, units] of Object.entries(typeGroups).sort()) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = type;

            for (const unit of units) {
                const option = document.createElement('option');
                option.value = unit.name;
                option.textContent = unit.abbrev ? `${unit.abbrev} - ${unit.name}` : unit.name;
                optgroup.appendChild(option);
            }

            select.appendChild(optgroup);
        }
        console.log(`Loaded ${data.units.length} units`);
    } catch (error) {
        console.warn('Could not load unit data:', error);
    }
}

/**
 * Handle unit selection from dropdown
 */
function selectUnit() {
    const select = document.getElementById('unitSelect');
    const selectedName = select.value;

    if (!selectedName) return;

    const selectedUnit = unitData.find(u => u.name === selectedName);
    if (selectedUnit) {
        document.getElementById('unitLine1').value = selectedUnit.name;
        // New format may not have higherHQ, use abbrev or leave blank
        document.getElementById('unitLine2').value = selectedUnit.higherHQ || '';
        // Address may have newlines, replace with actual line breaks for textarea
        document.getElementById('unitAddress').value = selectedUnit.address ? selectedUnit.address.replace(/\\n/g, '\n') : '';
        updatePreview();
    }
}

// =============================================================================
// REFERENCE LIBRARY
// =============================================================================

// Store reference library data globally
let referenceLibrary = [];
let referenceCategories = [];

/**
 * Load reference library from JSON
 */
async function loadReferenceLibrary() {
    try {
        const response = await fetch('data/references.json');
        const data = await response.json();
        referenceLibrary = data.references;
        referenceCategories = data.categories || [];

        // Populate category dropdown
        const categorySelect = document.getElementById('refLibraryCategory');
        if (categorySelect) {
            for (const category of referenceCategories) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            }
        }
        console.log(`Loaded ${referenceLibrary.length} references in ${referenceCategories.length} categories`);
    } catch (error) {
        console.warn('Could not load reference library:', error);
    }
}

/**
 * Open reference library modal
 */
function openReferenceLibrary() {
    const modal = document.getElementById('referenceLibraryModal');
    modal.style.display = 'flex';

    // Reset search
    document.getElementById('refLibrarySearch').value = '';
    document.getElementById('refLibraryCategory').value = '';

    // Populate list
    renderReferenceLibrary(referenceLibrary);

    // Focus search input
    setTimeout(() => {
        document.getElementById('refLibrarySearch').focus();
    }, 100);
}

/**
 * Close reference library modal
 */
function closeReferenceLibrary() {
    document.getElementById('referenceLibraryModal').style.display = 'none';
}

// Close modal on escape key or clicking outside
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const refModal = document.getElementById('referenceLibraryModal');
        if (refModal && refModal.style.display === 'flex') {
            closeReferenceLibrary();
        }
    }
});

document.addEventListener('click', function(e) {
    const refModal = document.getElementById('referenceLibraryModal');
    if (e.target === refModal) {
        closeReferenceLibrary();
    }
});

/**
 * Filter reference library based on search and category
 */
function filterReferenceLibrary() {
    const searchTerm = document.getElementById('refLibrarySearch').value.toLowerCase().trim();
    const category = document.getElementById('refLibraryCategory').value;

    let filtered = referenceLibrary;

    // Filter by category
    if (category) {
        filtered = filtered.filter(ref => ref.category === category);
    }

    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(ref => {
            const searchFields = [
                ref.type,
                ref.number,
                ref.title,
                ref.shortTitle || '',
                ...(ref.keywords || [])
            ].join(' ').toLowerCase();
            return searchFields.includes(searchTerm);
        });
    }

    renderReferenceLibrary(filtered);
}

/**
 * Render reference library list
 */
function renderReferenceLibrary(refs) {
    const list = document.getElementById('refLibraryList');

    if (refs.length === 0) {
        list.innerHTML = '<div class="ref-library-empty">No references found. Try a different search term.</div>';
        return;
    }

    list.innerHTML = refs.map(ref => `
        <div class="ref-library-item" onclick="addReferenceFromLibrary('${ref.type}', '${ref.number}', '${escapeHtml(ref.title)}')">
            <div class="ref-library-item-header">
                <span class="ref-library-item-type">${ref.type} ${ref.number}</span>
                <span class="ref-library-item-category">${ref.category}</span>
            </div>
            <div class="ref-library-item-title">${ref.title}</div>
            ${ref.shortTitle ? `<div class="ref-library-item-short">"${ref.shortTitle}"</div>` : ''}
        </div>
    `).join('');
}

/**
 * Add a reference from the library to the document
 */
function addReferenceFromLibrary(type, number, title) {
    // Format the reference text
    const refText = `${type} ${number}`;

    // Add a new reference with this text
    addReference(refText);

    // Close the modal
    closeReferenceLibrary();
}

/**
 * Escape HTML entities for safe rendering
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'");
}

// =============================================================================
// ENCLOSURE PDF MERGING
// =============================================================================

/**
 * Merge enclosure PDFs into the main document with proper formatting.
 * Since SwiftLaTeX doesn't support \includepdf, we use pdf-lib to:
 * 1. Remove placeholder pages for enclosures with attached PDFs
 * 2. Append the actual PDF pages with formatting overlays
 */
async function mergeEnclosurePdfs(mainPdfBytes) {
    const enclosuresWithFiles = enclosures.filter(e => e.file && e.file.data);

    if (enclosuresWithFiles.length === 0) {
        return mainPdfBytes;
    }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const data = collectData();

    // Load the main document
    const mainDoc = await PDFDocument.load(mainPdfBytes);
    const mainPageCount = mainDoc.getPageCount();

    console.log(`mergeEnclosurePdfs: mainPageCount=${mainPageCount}, enclosuresWithFiles=${enclosuresWithFiles.length}`);

    // Create output document
    const outputDoc = await PDFDocument.create();

    // Copy ALL pages from the main document
    // LaTeX now uses "JSPDF" marker for PDF enclosures, so it does NOT create placeholder pages for them
    // Text-only enclosures still get placeholder pages, which we keep
    const mainPages = await outputDoc.copyPages(mainDoc, mainDoc.getPageIndices());
    mainPages.forEach(page => outputDoc.addPage(page));

    // Embed font for overlays
    const courierFont = await outputDoc.embedFont(StandardFonts.Courier);

    // Letter paper dimensions (8.5 x 11 inches in points)
    const pageWidth = 612;
    const pageHeight = 792;

    // Process each enclosure with a file
    let enclIndex = 0;
    for (let i = 0; i < enclosures.length; i++) {
        const encl = enclosures[i];
        if (!encl.file || !encl.file.data) continue;

        enclIndex++;

        try {
            const enclDoc = await PDFDocument.load(encl.file.data);
            const enclPageCount = enclDoc.getPageCount();

            // Copy each page from enclosure
            for (let pageNum = 0; pageNum < enclPageCount; pageNum++) {
                // Create a new page
                const newPage = outputDoc.addPage([pageWidth, pageHeight]);

                // Embed the enclosure page (scaled to 85% within margins)
                const [embeddedPage] = await outputDoc.embedPdf(enclDoc, [pageNum]);
                const { width: origWidth, height: origHeight } = embeddedPage;

                // Calculate scaling to fit within border area (approx 85% of page)
                const maxWidth = pageWidth * 0.78;
                const maxHeight = pageHeight * 0.72;
                const scale = Math.min(maxWidth / origWidth, maxHeight / origHeight, 0.85);

                const scaledWidth = origWidth * scale;
                const scaledHeight = origHeight * scale;

                // Center the content
                const xOffset = (pageWidth - scaledWidth) / 2;
                const yOffset = (pageHeight - scaledHeight) / 2 - 20; // Shift down slightly

                // Draw border
                newPage.drawRectangle({
                    x: xOffset - 5,
                    y: yOffset - 5,
                    width: scaledWidth + 10,
                    height: scaledHeight + 10,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 1,
                });

                // Draw the embedded page
                newPage.drawPage(embeddedPage, {
                    x: xOffset,
                    y: yOffset,
                    width: scaledWidth,
                    height: scaledHeight,
                });

                // Add header (CUI marking if applicable)
                if (data.classLevel && data.classLevel !== 'unclassified') {
                    const headerText = data.classLevel === 'cui' ? 'CUI' : data.classLevel.toUpperCase().replace('_', ' ');
                    const headerWidth = courierFont.widthOfTextAtSize(headerText, 12);
                    newPage.drawText(headerText, {
                        x: (pageWidth - headerWidth) / 2,
                        y: pageHeight - 30,
                        size: 12,
                        font: courierFont,
                        color: rgb(0, 0, 0),
                    });
                }

                // Add footer with page number and enclosure label
                const pageLabel = `Enclosure (${i + 1}) - Page ${pageNum + 1} of ${enclPageCount}`;
                const pageLabelWidth = courierFont.widthOfTextAtSize(pageLabel, 10);
                newPage.drawText(pageLabel, {
                    x: (pageWidth - pageLabelWidth) / 2,
                    y: 30,
                    size: 10,
                    font: courierFont,
                    color: rgb(0, 0, 0),
                });

                // Add enclosure label in bottom right
                const enclLabel = `Encl (${i + 1})`;
                newPage.drawText(enclLabel, {
                    x: pageWidth - 72 - courierFont.widthOfTextAtSize(enclLabel, 10),
                    y: 50,
                    size: 10,
                    font: courierFont,
                    color: rgb(0, 0, 0),
                });
            }
        } catch (enclError) {
            console.warn(`Could not merge enclosure "${encl.title}":`, enclError);
        }
    }

    return await outputDoc.save();
}

// =============================================================================
// PDF PREVIEW
// =============================================================================

// Debounce timer for PDF preview
let pdfPreviewTimer = null;
let currentPdfUrl = null;
let currentPdfBytes = null; // Store raw bytes for iOS compatibility

/**
 * Update the PDF preview status message
 */
function setPdfPreviewStatus(message, type = 'loading') {
    const statusEl = document.getElementById('pdfPreviewStatus');
    if (statusEl) {
        statusEl.className = 'pdf-preview-status' + (type !== 'loading' ? ' ' + type : '');
        statusEl.innerHTML = type === 'loading'
            ? `<span class="pdf-loading">${message}</span>`
            : message;
        statusEl.classList.remove('hidden');
    }
}

/**
 * Hide the PDF preview status
 */
function hidePdfPreviewStatus() {
    const statusEl = document.getElementById('pdfPreviewStatus');
    if (statusEl) {
        statusEl.classList.add('hidden');
    }
}

/**
 * Check if running on iOS
 */
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Compile and display PDF in the preview iframe
 * Note: Enclosure PDFs are now embedded by LaTeX via \includepdf, not merged by JS.
 */
async function updatePdfPreview(retryAfterReset = false) {
    const frame = document.getElementById('pdfPreviewFrame');
    if (!frame) return;

    try {
        setPdfPreviewStatus('Compiling LaTeX...', 'loading');

        // Compile LaTeX document
        const pdfBytes = await compileLatex();

        // Merge enclosure PDFs if any
        const finalPdfBytes = await mergeEnclosurePdfs(pdfBytes);

        // Store raw bytes for iOS compatibility
        currentPdfBytes = finalPdfBytes;

        // Revoke previous blob URL to free memory
        if (currentPdfUrl) {
            URL.revokeObjectURL(currentPdfUrl);
        }

        // Create blob URL for the PDF
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        currentPdfUrl = URL.createObjectURL(blob);

        // Display in iframe (even if hidden on mobile, keep it updated)
        frame.src = currentPdfUrl;

        // Hide status after successful compilation
        hidePdfPreviewStatus();

    } catch (error) {
        console.error('PDF preview error:', error);

        // Auto-recover from fatal format errors by resetting engine
        if (error.message === 'ENGINE_RESET_NEEDED' && !retryAfterReset) {
            console.log('Auto-recovering from fatal format error...');
            setPdfPreviewStatus('Resetting engine...', 'loading');
            await resetLatexEngine();
            // Retry once after reset
            return updatePdfPreview(true);
        }

        setPdfPreviewStatus('Compilation failed: ' + error.message, 'error');
    }
}

/**
 * Debounced PDF preview update
 * Waits 1.5 seconds after last change before recompiling
 */
function schedulePdfPreviewUpdate() {
    if (pdfPreviewTimer) {
        clearTimeout(pdfPreviewTimer);
    }
    setPdfPreviewStatus('Waiting for changes...', 'loading');
    pdfPreviewTimer = setTimeout(updatePdfPreview, 1500);
}

/**
 * Force refresh the PDF preview immediately
 */
function refreshPdfPreview() {
    if (pdfPreviewTimer) {
        clearTimeout(pdfPreviewTimer);
        pdfPreviewTimer = null;
    }
    updatePdfPreview();
}

/**
 * Toggle PDF preview panel visibility (desktop only)
 */
let previewHidden = false;

function togglePreviewPanel() {
    const previewPanel = document.getElementById('pdfPreviewPanel');
    const formPanel = document.getElementById('correspondencePanel');
    const showBtn = document.getElementById('showPreviewBtn');

    previewHidden = !previewHidden;

    if (previewHidden) {
        // Hide preview
        previewPanel.classList.add('hidden');
        formPanel.classList.add('expanded');
        showBtn.style.display = 'block';
    } else {
        // Show preview
        previewPanel.classList.remove('hidden');
        formPanel.classList.remove('expanded');
        showBtn.style.display = 'none';
        // Refresh preview when shown
        if (engineReady) {
            schedulePdfPreviewUpdate();
        }
    }

    // Save preference to localStorage
    localStorage.setItem('libo_preview_hidden', previewHidden ? '1' : '0');
}

/**
 * Restore preview panel visibility preference
 */
function restorePreviewPreference() {
    const saved = localStorage.getItem('libo_preview_hidden');
    if (saved === '1') {
        // Apply hidden state without toggling
        previewHidden = true;
        const previewPanel = document.getElementById('pdfPreviewPanel');
        const formPanel = document.getElementById('correspondencePanel');
        const showBtn = document.getElementById('showPreviewBtn');

        previewPanel.classList.add('hidden');
        formPanel.classList.add('expanded');
        showBtn.style.display = 'block';
    }
}

/**
 * Initialize PDF preview on engine ready
 */
async function initPdfPreview() {
    setPdfPreviewStatus('Initializing LaTeX engine...', 'loading');

    try {
        await initLatexEngine();
        if (engineReady) {
            setPdfPreviewStatus('Engine ready. Compiling...', 'loading');
            await updatePdfPreview();
        } else {
            setPdfPreviewStatus('LaTeX engine unavailable', 'error');
        }
    } catch (error) {
        console.error('Failed to initialize PDF preview:', error);
        setPdfPreviewStatus('Failed to initialize: ' + error.message, 'error');
    }
}

// =============================================================================
// MOBILE DETECTION & RESPONSIVE FEATURES
// =============================================================================

/**
 * Check if device is mobile based on viewport width only
 * Uses 768px breakpoint - avoids touch detection which causes false positives
 * on touchscreen laptops
 */
function isMobileDevice() {
    return window.innerWidth <= 768;
}

/**
 * Track mobile state for responsive UI updates
 */
let currentMobileState = false;

/**
 * Update UI based on mobile/desktop state
 * @param {boolean} force - Force update even if state hasn't changed
 */
function updateMobileUI(force = false) {
    const isMobile = isMobileDevice();

    // Only update if state changed (unless forced)
    if (!force && isMobile === currentMobileState) return;
    currentMobileState = isMobile;

    const previewPanel = document.getElementById('pdfPreviewPanel');
    const mobilePreviewBtn = document.getElementById('mobilePreviewBtn');
    const previewModal = document.getElementById('pdfPreviewModal');

    console.log('updateMobileUI:', { isMobile, width: window.innerWidth });

    if (isMobile) {
        // Mobile: hide inline preview, show toggle button
        if (previewPanel) previewPanel.style.display = 'none';
        if (mobilePreviewBtn) mobilePreviewBtn.style.display = 'flex';
    } else {
        // Desktop: show inline preview, hide toggle button and modal
        if (previewPanel) previewPanel.style.display = 'flex';
        if (mobilePreviewBtn) mobilePreviewBtn.style.display = 'none';
        if (previewModal) previewModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

/**
 * Open fullscreen PDF preview modal (mobile)
 * Uses data URL on iOS for better compatibility
 */
function openMobilePreview() {
    const modal = document.getElementById('pdfPreviewModal');
    const modalFrame = document.getElementById('modalPdfFrame');

    if (!modal || !modalFrame) return;

    // On iOS, use data URL for better blob handling
    // On other platforms, use the blob URL directly
    if (isIOS() && currentPdfBytes) {
        // Convert bytes to base64 data URL for iOS
        const base64 = btoa(
            new Uint8Array(currentPdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        modalFrame.src = 'data:application/pdf;base64,' + base64;
    } else if (currentPdfUrl) {
        // Use blob URL on other platforms
        modalFrame.src = currentPdfUrl;
    } else {
        // Fallback: try main frame src
        const mainFrame = document.getElementById('pdfPreviewFrame');
        if (mainFrame && mainFrame.src) {
            modalFrame.src = mainFrame.src;
        }
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

/**
 * Close fullscreen PDF preview modal
 */
function closeMobilePreview() {
    const modal = document.getElementById('pdfPreviewModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

/**
 * Initialize mobile preview button and modal
 */
function initMobilePreview() {
    // Create mobile preview button if it doesn't exist
    if (!document.getElementById('mobilePreviewBtn')) {
        const btn = document.createElement('button');
        btn.id = 'mobilePreviewBtn';
        btn.className = 'mobile-preview-btn';
        btn.innerHTML = '<span class="mobile-preview-icon">📄</span><span>View PDF</span>';
        btn.onclick = openMobilePreview;
        btn.style.display = 'none'; // Initially hidden, shown by updateMobileUI
        document.body.appendChild(btn);
    }

    // Create modal if it doesn't exist
    if (!document.getElementById('pdfPreviewModal')) {
        const modal = document.createElement('div');
        modal.id = 'pdfPreviewModal';
        modal.className = 'pdf-preview-modal';
        modal.innerHTML = `
            <div class="modal-header">
                <span class="modal-title">PDF Preview</span>
                <button class="modal-close-btn" onclick="closeMobilePreview()">×</button>
            </div>
            <div class="modal-body">
                <iframe id="modalPdfFrame" class="modal-pdf-frame"></iframe>
            </div>
            <div class="modal-footer">
                <button class="modal-download-btn" onclick="downloadLatexPDF(); closeMobilePreview();">
                    Download PDF
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Set initial state - force update on first call
    currentMobileState = null; // Reset to force initial update
    updateMobileUI(true);

    // Listen for window resize and orientation change
    window.addEventListener('resize', () => updateMobileUI(false));
    window.addEventListener('orientationchange', () => {
        // Delay to let orientation settle
        setTimeout(() => updateMobileUI(true), 100);
    });
}

// =============================================================================
// FORMS MODE - Pre-formatted USMC Forms
// =============================================================================

// Current mode: 'correspondence' or 'forms'
let currentMode = 'correspondence';

// Form templates data
let formTemplates = {};

// Signature pad state
let signatureCtx = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

/**
 * Switch between correspondence and forms mode
 * Note: Forms mode is currently disabled (coming soon)
 */
function switchMode(mode) {
    // Forms mode is currently disabled
    if (mode === 'forms') {
        return;
    }

    currentMode = mode;

    // Update button states
    document.getElementById('modeCorrespondence').classList.toggle('active', mode === 'correspondence');
    document.getElementById('modeForms').classList.toggle('active', mode === 'forms');

    // Show/hide panels
    document.getElementById('correspondencePanel').style.display = mode === 'correspondence' ? 'block' : 'none';
    document.getElementById('formsPanel').style.display = mode === 'forms' ? 'block' : 'none';

    // If switching to forms, initialize signature pad
    if (mode === 'forms') {
        initSignaturePad();
    }
}

/**
 * Load form templates from JSON
 */
async function loadFormTemplates() {
    try {
        const response = await fetch('data/form-templates.json');
        const data = await response.json();
        formTemplates = {};
        data.templates.forEach(t => {
            formTemplates[t.id] = t;
        });
        console.log('Loaded form templates:', Object.keys(formTemplates));
    } catch (error) {
        console.error('Failed to load form templates:', error);
    }
}

/**
 * Handle form template selection
 */
function selectFormTemplate() {
    const templateId = document.getElementById('formTemplateSelect').value;
    const formFields = document.getElementById('formFields');
    const signatureSection = document.getElementById('signatureSection');
    const formActions = document.getElementById('formActions');

    if (!templateId) {
        formFields.innerHTML = '';
        signatureSection.style.display = 'none';
        formActions.style.display = 'none';
        return;
    }

    const template = formTemplates[templateId];
    if (!template) {
        console.error('Template not found:', templateId);
        return;
    }

    // Build form fields
    let html = `<h2>${template.name}</h2>`;
    html += `<p class="hint">${template.description}</p>`;

    template.fields.forEach(field => {
        html += `<label>${field.label}${field.required ? ' *' : ''}</label>`;

        if (field.type === 'textarea') {
            html += `<textarea id="form_${field.id}"
                        placeholder="${field.placeholder || ''}"
                        rows="${field.rows || 4}"
                        ${field.required ? 'required' : ''}></textarea>`;
        } else if (field.type === 'date') {
            html += `<input type="date" id="form_${field.id}" ${field.required ? 'required' : ''}>`;
        } else {
            html += `<input type="text" id="form_${field.id}"
                        placeholder="${field.placeholder || ''}"
                        ${field.pattern ? `pattern="${field.pattern}"` : ''}
                        ${field.required ? 'required' : ''}>`;
        }

        if (field.helpText) {
            html += `<p class="hint">${field.helpText}</p>`;
        }
    });

    formFields.innerHTML = html;

    // Show signature section if template has signatures
    if (template.signatures && template.signatures.length > 0) {
        signatureSection.style.display = 'block';
        initSignaturePad();
    } else {
        signatureSection.style.display = 'none';
    }

    // Show form actions
    formActions.style.display = 'block';
}

/**
 * Initialize signature pad canvas
 */
function initSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;

    signatureCtx = canvas.getContext('2d');

    // Set up canvas for high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    signatureCtx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Clear and set up
    signatureCtx.fillStyle = 'white';
    signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
    signatureCtx.strokeStyle = '#000';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    const rect = e.target.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    isDrawing = true;
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();

    lastX = x;
    lastY = y;
}

/**
 * Clear the signature pad
 */
function clearSignature() {
    const canvas = document.getElementById('signaturePad');
    if (canvas && signatureCtx) {
        signatureCtx.fillStyle = 'white';
        signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Get signature as base64 PNG
 */
function getSignatureData() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
}

/**
 * Clear all form fields
 */
function clearFormFields() {
    const templateId = document.getElementById('formTemplateSelect').value;
    if (!templateId) return;

    const template = formTemplates[templateId];
    if (!template) return;

    template.fields.forEach(field => {
        const el = document.getElementById('form_' + field.id);
        if (el) el.value = '';
    });

    clearSignature();
}

/**
 * Collect form data from fields
 */
function collectFormData() {
    const templateId = document.getElementById('formTemplateSelect').value;
    if (!templateId) return null;

    const template = formTemplates[templateId];
    if (!template) return null;

    const data = {
        templateId: templateId,
        templateName: template.name,
        fields: {}
    };

    template.fields.forEach(field => {
        const el = document.getElementById('form_' + field.id);
        data.fields[field.id] = el ? el.value : '';
    });

    // Get signature
    data.signature = getSignatureData();

    return data;
}

/**
 * Generate PDF for the selected form
 */
async function generateFormPDF() {
    const data = collectFormData();
    if (!data) {
        alert('Please select a form first');
        return;
    }

    // Validate required fields
    const template = formTemplates[data.templateId];
    for (const field of template.fields) {
        if (field.required && !data.fields[field.id]) {
            alert(`Please fill in: ${field.label}`);
            document.getElementById('form_' + field.id)?.focus();
            return;
        }
    }

    try {
        // For now, generate using pdf-lib directly (LaTeX form templates can come later)
        const pdfBytes = await generateFormPDFWithPdfLib(data);

        // Download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Update preview if visible
        const frame = document.getElementById('pdfPreviewFrame');
        if (frame) {
            frame.src = url;
        }

        // Auto-download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.templateId}_${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();

    } catch (error) {
        console.error('Form PDF generation error:', error);
        alert('Failed to generate PDF: ' + error.message);
    }
}

/**
 * Generate form PDF using pdf-lib
 * This creates a filled version of the official form layout
 */
async function generateFormPDFWithPdfLib(data) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const courier = await doc.embedFont(StandardFonts.Courier);

    // Letter size
    const pageWidth = 612;
    const pageHeight = 792;

    if (data.templateId === 'navmc-118-11') {
        // NAVMC 118(11) - Page 11
        const page = doc.addPage([pageWidth, pageHeight]);

        // Draw form structure
        const margin = 36; // 0.5 inch

        // Title
        page.drawText('ADMINISTRATIVE REMARKS (1070)', {
            x: pageWidth / 2 - 120,
            y: pageHeight - 50,
            size: 14,
            font: helveticaBold,
        });

        // Large G
        page.drawText('G', {
            x: pageWidth - 60,
            y: pageHeight - 70,
            size: 60,
            font: helveticaBold,
        });

        // Top boxes (UCMJ/SBP) - simplified version
        const boxTop = pageHeight - 100;
        const boxHeight = 80;
        const boxWidth = (pageWidth - margin * 2) / 3;

        // Draw three top boxes
        for (let i = 0; i < 3; i++) {
            page.drawRectangle({
                x: margin + i * boxWidth,
                y: boxTop - boxHeight,
                width: boxWidth,
                height: boxHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 0.5,
                color: rgb(0.8, 0.87, 0.93),
            });
        }

        // Main remarks area
        const remarksTop = boxTop - boxHeight - 10;
        const remarksHeight = 480;

        page.drawRectangle({
            x: margin,
            y: remarksTop - remarksHeight,
            width: pageWidth - margin * 2,
            height: remarksHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
            color: rgb(0.8, 0.87, 0.93),
        });

        // Draw vertical line in middle
        page.drawLine({
            start: { x: pageWidth / 2, y: remarksTop },
            end: { x: pageWidth / 2, y: remarksTop - remarksHeight },
            thickness: 0.5,
            color: rgb(0, 0, 0),
        });

        // Entry text
        if (data.fields.entryText) {
            const entryLines = data.fields.entryText.split('\n');
            let yPos = remarksTop - 20;
            const lineHeight = 12;

            // Add date prefix
            if (data.fields.entryDate) {
                const dateStr = new Date(data.fields.entryDate).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                }).toUpperCase();
                page.drawText(dateStr + ':', {
                    x: margin + 10,
                    y: yPos,
                    size: 10,
                    font: courier,
                });
                yPos -= lineHeight * 1.5;
            }

            // Word wrap and draw entry text
            const maxWidth = (pageWidth - margin * 2) / 2 - 20;
            for (const line of entryLines) {
                const words = line.split(' ');
                let currentLine = '';

                for (const word of words) {
                    const testLine = currentLine + (currentLine ? ' ' : '') + word;
                    const width = courier.widthOfTextAtSize(testLine, 10);

                    if (width > maxWidth && currentLine) {
                        page.drawText(currentLine, {
                            x: margin + 10,
                            y: yPos,
                            size: 10,
                            font: courier,
                        });
                        yPos -= lineHeight;
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }

                if (currentLine) {
                    page.drawText(currentLine, {
                        x: margin + 10,
                        y: yPos,
                        size: 10,
                        font: courier,
                    });
                    yPos -= lineHeight;
                }
            }
        }

        // Footer boxes
        const footerTop = remarksTop - remarksHeight - 10;
        const footerHeight = 30;

        // Name box
        page.drawRectangle({
            x: margin,
            y: footerTop - footerHeight,
            width: (pageWidth - margin * 2) * 0.7,
            height: footerHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
        });

        page.drawText('NAME (last, first, middle)', {
            x: margin + 5,
            y: footerTop - 10,
            size: 8,
            font: helvetica,
        });

        page.drawText(data.fields.marineName || '', {
            x: margin + 5,
            y: footerTop - 22,
            size: 10,
            font: helveticaBold,
        });

        // EDIPI box
        page.drawRectangle({
            x: margin + (pageWidth - margin * 2) * 0.7,
            y: footerTop - footerHeight,
            width: (pageWidth - margin * 2) * 0.3,
            height: footerHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
        });

        page.drawText('EDIPI', {
            x: margin + (pageWidth - margin * 2) * 0.7 + 5,
            y: footerTop - 10,
            size: 8,
            font: helvetica,
        });

        page.drawText(data.fields.edipi || '', {
            x: margin + (pageWidth - margin * 2) * 0.7 + 5,
            y: footerTop - 22,
            size: 10,
            font: helveticaBold,
        });

        // Form number footer
        page.drawText('NAVMC 118(11) (REV. 05-2014) (EF)', {
            x: margin,
            y: 40,
            size: 8,
            font: helvetica,
        });

        page.drawText('PREVIOUS EDITIONS ARE OBSOLETE', {
            x: margin,
            y: 30,
            size: 6,
            font: helvetica,
        });

        page.drawText('11.', {
            x: pageWidth / 2 - 10,
            y: 35,
            size: 10,
            font: helvetica,
        });

        page.drawText('FOUO - Privacy sensitive when filled in', {
            x: pageWidth / 2 - 80,
            y: 15,
            size: 8,
            font: helveticaBold,
        });

    } else if (data.templateId === 'navmc-10274') {
        // NAVMC 10274 - Administrative Action (6105)
        // TODO: Implement this form
        const page = doc.addPage([pageWidth, pageHeight]);
        page.drawText('NAVMC 10274 - Coming Soon', {
            x: 200,
            y: 400,
            size: 20,
            font: helveticaBold,
        });
    }

    return await doc.save();
}

// =============================================================================
// PROFILE MANAGEMENT
// =============================================================================

/**
 * Get all saved profiles
 */
function getProfiles() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_PROFILES);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error('Error loading profiles:', e);
        return {};
    }
}

/**
 * Save profiles to localStorage
 */
function saveProfiles(profiles) {
    try {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    } catch (e) {
        console.error('Error saving profiles:', e);
    }
}

/**
 * Populate the profile dropdown
 */
function populateProfileDropdown() {
    const select = document.getElementById('profileSelect');
    const profiles = getProfiles();

    // Clear existing options except the first
    select.innerHTML = '<option value="">-- Select Profile --</option>';

    // Add saved profiles
    for (const name of Object.keys(profiles).sort()) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
}

/**
 * Save current form data as a profile
 */
function saveProfileAs() {
    const name = prompt('Enter profile name (e.g., "1/6 - SSgt Smith"):');
    if (!name || !name.trim()) return;

    const profileName = name.trim();
    const profiles = getProfiles();

    // Check if overwriting
    if (profiles[profileName]) {
        if (!confirm(`Profile "${profileName}" already exists. Overwrite?`)) {
            return;
        }
    }

    // Save profile data (only user-specific fields, not document content)
    profiles[profileName] = {
        // Letterhead
        unitLine1: document.getElementById('unitLine1').value,
        unitLine2: document.getElementById('unitLine2').value,
        unitAddress: document.getElementById('unitAddress').value,
        // Signatory
        from: document.getElementById('from').value,
        sigFirst: document.getElementById('sigFirst').value,
        sigMiddle: document.getElementById('sigMiddle').value,
        sigLast: document.getElementById('sigLast').value,
        sigRank: document.getElementById('sigRank').value,
        sigTitle: document.getElementById('sigTitle').value,
        // Classification defaults
        cuiControlledBy: document.getElementById('cuiControlledBy').value,
        pocEmail: document.getElementById('pocEmail').value,
    };

    saveProfiles(profiles);
    populateProfileDropdown();

    // Select the newly saved profile
    document.getElementById('profileSelect').value = profileName;

    showAutoSaveStatus('Profile saved!');
}

/**
 * Load selected profile
 */
function loadProfile() {
    const select = document.getElementById('profileSelect');
    const profileName = select.value;

    if (!profileName) return;

    const profiles = getProfiles();
    const profile = profiles[profileName];

    if (!profile) return;

    // Apply profile data to form
    if (profile.unitLine1 !== undefined) document.getElementById('unitLine1').value = profile.unitLine1;
    if (profile.unitLine2 !== undefined) document.getElementById('unitLine2').value = profile.unitLine2;
    if (profile.unitAddress !== undefined) document.getElementById('unitAddress').value = profile.unitAddress;
    if (profile.ssic !== undefined) document.getElementById('ssic').value = profile.ssic;
    if (profile.from !== undefined) document.getElementById('from').value = profile.from;
    if (profile.sigFirst !== undefined) document.getElementById('sigFirst').value = profile.sigFirst;
    if (profile.sigMiddle !== undefined) document.getElementById('sigMiddle').value = profile.sigMiddle;
    if (profile.sigLast !== undefined) document.getElementById('sigLast').value = profile.sigLast;
    if (profile.sigRank !== undefined) document.getElementById('sigRank').value = profile.sigRank;
    if (profile.sigTitle !== undefined) document.getElementById('sigTitle').value = profile.sigTitle;
    if (profile.cuiControlledBy !== undefined) document.getElementById('cuiControlledBy').value = profile.cuiControlledBy;
    if (profile.pocEmail !== undefined) document.getElementById('pocEmail').value = profile.pocEmail;

    showAutoSaveStatus('Profile loaded');
    updatePreview();
}

/**
 * Delete selected profile
 */
function deleteProfile() {
    const select = document.getElementById('profileSelect');
    const profileName = select.value;

    if (!profileName) {
        alert('Please select a profile to delete.');
        return;
    }

    if (!confirm(`Delete profile "${profileName}"?`)) {
        return;
    }

    const profiles = getProfiles();
    delete profiles[profileName];
    saveProfiles(profiles);

    populateProfileDropdown();
    showAutoSaveStatus('Profile deleted');
}

// Track if we're editing an existing profile
let editingProfileName = null;

/**
 * Open profile editor modal for creating a new profile
 */
function openProfileEditor() {
    editingProfileName = null;
    document.getElementById('profileEditorTitle').textContent = 'Create New Profile';

    // Clear all fields
    document.getElementById('profileName').value = '';
    document.getElementById('profileCommandName').value = '';
    document.getElementById('profileCommandAddress').value = '';
    document.getElementById('profileCommandCity').value = '';
    document.getElementById('profileSSIC').value = '';
    document.getElementById('profileFirstName').value = '';
    document.getElementById('profileMiddleInitial').value = '';
    document.getElementById('profileLastName').value = '';
    document.getElementById('profileRank').value = '';
    document.getElementById('profileTitle').value = '';
    document.getElementById('profileFromLine').value = '';

    document.getElementById('profileEditorModal').style.display = 'flex';
    document.getElementById('profileName').focus();
}

/**
 * Edit the currently selected profile
 */
function editCurrentProfile() {
    const select = document.getElementById('profileSelect');
    const profileName = select.value;

    if (!profileName) {
        alert('Please select a profile to edit, or click + to create a new one.');
        return;
    }

    const profiles = getProfiles();
    const profile = profiles[profileName];

    if (!profile) return;

    editingProfileName = profileName;
    document.getElementById('profileEditorTitle').textContent = 'Edit Profile';

    // Populate fields from profile
    document.getElementById('profileName').value = profileName;
    document.getElementById('profileCommandName').value = profile.unitLine1 || '';
    document.getElementById('profileCommandAddress').value = profile.unitLine2 || '';
    document.getElementById('profileCommandCity').value = profile.unitAddress || '';
    document.getElementById('profileSSIC').value = profile.ssic || '';
    document.getElementById('profileFirstName').value = profile.sigFirst || '';
    document.getElementById('profileMiddleInitial').value = profile.sigMiddle || '';
    document.getElementById('profileLastName').value = profile.sigLast || '';
    document.getElementById('profileRank').value = profile.sigRank || '';
    document.getElementById('profileTitle').value = profile.sigTitle || '';
    document.getElementById('profileFromLine').value = profile.from || '';

    document.getElementById('profileEditorModal').style.display = 'flex';
}

/**
 * Close profile editor modal
 */
function closeProfileEditor() {
    document.getElementById('profileEditorModal').style.display = 'none';
    editingProfileName = null;
}

/**
 * Save profile from editor modal
 */
function saveProfileFromEditor() {
    const profileName = document.getElementById('profileName').value.trim();

    if (!profileName) {
        alert('Please enter a profile name.');
        document.getElementById('profileName').focus();
        return;
    }

    const profiles = getProfiles();

    // Check for name conflicts (unless we're editing the same profile)
    if (profiles[profileName] && editingProfileName !== profileName) {
        if (!confirm(`Profile "${profileName}" already exists. Overwrite?`)) {
            return;
        }
    }

    // If renaming a profile, delete the old one
    if (editingProfileName && editingProfileName !== profileName) {
        delete profiles[editingProfileName];
    }

    // Build profile data
    profiles[profileName] = {
        // Letterhead
        unitLine1: document.getElementById('profileCommandName').value,
        unitLine2: document.getElementById('profileCommandAddress').value,
        unitAddress: document.getElementById('profileCommandCity').value,
        ssic: document.getElementById('profileSSIC').value,
        // Signatory
        from: document.getElementById('profileFromLine').value,
        sigFirst: document.getElementById('profileFirstName').value,
        sigMiddle: document.getElementById('profileMiddleInitial').value,
        sigLast: document.getElementById('profileLastName').value,
        sigRank: document.getElementById('profileRank').value,
        sigTitle: document.getElementById('profileTitle').value,
        // Preserve existing classification defaults if editing
        cuiControlledBy: editingProfileName ? (profiles[editingProfileName]?.cuiControlledBy || '') : '',
        pocEmail: editingProfileName ? (profiles[editingProfileName]?.pocEmail || '') : '',
    };

    saveProfiles(profiles);
    populateProfileDropdown();

    // Select and load the saved profile
    document.getElementById('profileSelect').value = profileName;
    loadProfile();

    closeProfileEditor();
    showAutoSaveStatus('Profile saved!');
}

/**
 * Export all profiles to a JSON file
 */
function exportProfiles() {
    const profiles = getProfiles();

    if (Object.keys(profiles).length === 0) {
        alert('No profiles to export. Save a profile first.');
        return;
    }

    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        profiles: profiles
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `libo-profiles-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAutoSaveStatus('Profiles exported!');
}

/**
 * Import profiles from a JSON file
 */
function importProfiles(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);

            // Validate structure
            if (!importData.profiles || typeof importData.profiles !== 'object') {
                throw new Error('Invalid profile file format');
            }

            const existingProfiles = getProfiles();
            const importedCount = Object.keys(importData.profiles).length;

            // Check for conflicts
            const conflicts = Object.keys(importData.profiles).filter(name => existingProfiles[name]);

            let proceed = true;
            if (conflicts.length > 0) {
                proceed = confirm(
                    `${conflicts.length} profile(s) already exist:\n${conflicts.join(', ')}\n\nOverwrite existing profiles?`
                );
            }

            if (proceed) {
                // Merge profiles
                const mergedProfiles = { ...existingProfiles, ...importData.profiles };
                saveProfiles(mergedProfiles);
                populateProfileDropdown();
                showAutoSaveStatus(`Imported ${importedCount} profile(s)`);
            }
        } catch (err) {
            console.error('Error importing profiles:', err);
            alert('Failed to import profiles. Make sure the file is a valid libo-profiles JSON file.');
        }
    };
    reader.readAsText(file);

    // Reset file input so same file can be selected again
    event.target.value = '';
}


// =============================================================================
// DRAFT AUTO-SAVE
// =============================================================================

/**
 * Show auto-save status message
 */
function showAutoSaveStatus(message) {
    const status = document.getElementById('autoSaveStatus');
    status.textContent = message;
    status.className = 'auto-save-status saved';

    setTimeout(() => {
        status.textContent = '';
        status.className = 'auto-save-status';
    }, 2000);
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 */
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
        return 'yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        // Format as date
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
}

/**
 * Save current draft to localStorage
 */
function saveDraft() {
    try {
        const data = collectData();

        // Add metadata
        const draftData = {
            version: DRAFT_VERSION,
            savedAt: new Date().toISOString(),
            formData: data
        };

        localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draftData));

        // Save references and enclosures separately (they're arrays)
        localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(references));
        // Note: enclosures contain File objects which can't be serialized
        // We'll save the metadata only
        const enclMeta = enclosures.map(e => ({
            name: e.name,
            title: e.title
            // file: cannot be serialized
        }));
        localStorage.setItem(STORAGE_KEY_ENCLS, JSON.stringify(enclMeta));

        // Save copy-to recipients
        localStorage.setItem(STORAGE_KEY_COPYTOS, JSON.stringify(copyTos));

        // Save paragraphs
        localStorage.setItem(STORAGE_KEY_PARAS, JSON.stringify(paragraphs));

        showAutoSaveStatus('Draft saved');
    } catch (e) {
        console.error('Error saving draft:', e);
    }
}

/**
 * Schedule auto-save (debounced)
 */
function scheduleAutoSave() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    const status = document.getElementById('autoSaveStatus');
    status.textContent = 'Saving...';
    status.className = 'auto-save-status saving';

    autoSaveTimer = setTimeout(() => {
        saveDraft();
    }, 1000); // Save 1 second after last change
}

/**
 * Check for saved draft and show restore modal if found
 * Returns true if a draft exists and modal is shown
 */
function checkForDraft() {
    try {
        const draftJson = localStorage.getItem(STORAGE_KEY_DRAFT);
        if (!draftJson) return false;

        const draftData = JSON.parse(draftJson);

        // Check version compatibility
        if (draftData.version !== DRAFT_VERSION) {
            console.log('Draft version mismatch, clearing old draft');
            clearDraftStorage();
            return false;
        }

        // Check if we have actual form data
        if (!draftData.formData || Object.keys(draftData.formData).length === 0) {
            return false;
        }

        // Show restore modal with timestamp
        const savedAt = new Date(draftData.savedAt);
        const relativeTime = getRelativeTime(savedAt);

        document.getElementById('restoreTimestamp').textContent = relativeTime;
        document.getElementById('restoreModal').style.display = 'flex';

        return true;
    } catch (e) {
        console.error('Error checking for draft:', e);
        return false;
    }
}

/**
 * Handle user's restore decision from modal
 */
function confirmRestore(shouldRestore) {
    document.getElementById('restoreModal').style.display = 'none';

    if (shouldRestore) {
        restoreDraft();
        showAutoSaveStatus('Draft restored');
    } else {
        clearDraftStorage();
        showAutoSaveStatus('Started fresh');
    }
}

/**
 * Clear draft from storage without resetting form
 */
function clearDraftStorage() {
    localStorage.removeItem(STORAGE_KEY_DRAFT);
    localStorage.removeItem(STORAGE_KEY_REFS);
    localStorage.removeItem(STORAGE_KEY_ENCLS);
    localStorage.removeItem(STORAGE_KEY_COPYTOS);
    localStorage.removeItem(STORAGE_KEY_PARAS);
}

/**
 * Restore draft data to form
 */
function restoreDraft() {
    try {
        const draftJson = localStorage.getItem(STORAGE_KEY_DRAFT);
        if (!draftJson) return false;

        const draftData = JSON.parse(draftJson);

        // Extract form data from wrapper (or use data directly for old format)
        const data = draftData.formData || draftData;

        // Restore form fields
        for (const [key, value] of Object.entries(data)) {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = value;
                } else {
                    el.value = value;
                }
            }
        }

        // Restore references
        const refsJson = localStorage.getItem(STORAGE_KEY_REFS);
        if (refsJson) {
            references = JSON.parse(refsJson);
            renderReferences();
        }

        // Restore enclosure metadata (files need to be re-uploaded)
        const enclJson = localStorage.getItem(STORAGE_KEY_ENCLS);
        if (enclJson) {
            const enclMeta = JSON.parse(enclJson);
            // Restore enclosures array with metadata (without file data)
            enclosures = enclMeta.map(e => ({
                title: e.title || '',
                file: null // Files can't be serialized, user must re-upload
            }));
            renderEnclosures();
            if (enclMeta.length > 0) {
                console.log('Enclosure titles restored. PDF files need to be re-uploaded.');
            }
        }

        // Restore copy-to recipients
        const copyToJson = localStorage.getItem(STORAGE_KEY_COPYTOS);
        if (copyToJson) {
            copyTos = JSON.parse(copyToJson);
            renderCopyTos();
        }

        // Restore paragraphs
        const parasJson = localStorage.getItem(STORAGE_KEY_PARAS);
        if (parasJson) {
            const savedParas = JSON.parse(parasJson);
            // Ensure backward compatibility - add level: 0 if missing
            paragraphs = savedParas.map(para => ({
                text: para.text || '',
                level: para.level || 0
            }));
            renderParagraphs();
        }

        // Update UI based on restored docType
        updateDocTypeFields();

        return true;
    } catch (e) {
        console.error('Error restoring draft:', e);
        return false;
    }
}

/**
 * Clear draft and reset form
 */
function clearDraft() {
    if (!confirm('Clear all form data and start fresh?')) {
        return;
    }

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY_DRAFT);
    localStorage.removeItem(STORAGE_KEY_REFS);
    localStorage.removeItem(STORAGE_KEY_ENCLS);
    localStorage.removeItem(STORAGE_KEY_COPYTOS);
    localStorage.removeItem(STORAGE_KEY_PARAS);

    // Reset form to defaults
    location.reload();
}

/**
 * Hook into form inputs to trigger auto-save
 */
function initAutoSave() {
    // Add listeners to all form inputs
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        // Skip profile select to avoid saving when loading profile
        if (input.id === 'profileSelect') return;

        input.addEventListener('input', scheduleAutoSave);
        input.addEventListener('change', scheduleAutoSave);
    });
}


// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Load data files
    loadSSICData();
    loadUnitData();
    loadReferenceLibrary();
    loadFormTemplates();

    // Initialize drag-drop for PDF uploads
    initDragDrop();

    // Populate profile dropdown
    populateProfileDropdown();

    // Check for saved draft and show restore modal if exists
    checkForDraft();

    // Initialize references, enclosures, and paragraphs lists
    renderReferences();
    renderEnclosures();
    renderParagraphs();

    // Initialize regulation hints on load
    updateRegulationHighlights();

    // Initialize mobile responsive features
    initMobilePreview();

    // Restore preview panel visibility preference
    restorePreviewPreference();

    // Initialize auto-save
    initAutoSave();

    // Initialize PDF preview (this replaces updatePreview for initial load)
    initPdfPreview();
});
