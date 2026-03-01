// =============================================
// مساعد الأستاذ — إدارة ذكية للفصل v2.0
// Chat OCR + Student Picker + Sections + TTS
// =============================================

(function () {
    'use strict';

    // ===== State =====
    const PREFS_KEY = 'ocrAssistant_prefs_v2';
    const SECTIONS_KEY = 'ocrAssistant_sections_v1';
    let currentImageBlobs = []; // support multiple images
    let currentImageUrls = [];
    let cameraStream = null;
    let prefs = { darkMode: true, apiKey: '' };

    // Sections management
    let sections = [];
    let activeSectionId = null;
    let absentMode = false;

    // Navigation
    let currentView = 'viewHome';
    const VIEW_TITLES = {
        viewHome: ['مساعد الأستاذ', 'إدارة ذكية للفصل'],
        viewOCR: ['استخراج النصوص', 'استخرج أسماء الطلاب من الصور'],
        viewClasses: ['المرحلة والصفوف', 'إدارة الصفوف وحفظ الطلاب'],
        viewPicker: ['اختيار عشوائي', 'اختر طالباً عشوائياً']
    };

    // ===== DOM Helpers =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ===== Init =====
    function init() {
        loadPrefs();
        loadSections();
        initTheme();
        initParticles();
        initApiKey();
        initDropZone();
        initCamera();
        initPaste();
        initExtract();
        initClearChat();
        initStudentPicker();
        initSectionManagement();
        initManualEntry();
        initViews();
        initSplash();
        initPWA();

        $('#darkModeToggle').addEventListener('click', toggleTheme);

        // Restore sections UI if any exist
        if (sections.length > 0) {
            renderSectionTabs();
            renderStudentList();
            updatePickerUI();
            updatePickerVisibility();
        }
        updateHomeStats();
    }

    // ===== Persistence =====
    function loadPrefs() {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
        } catch (e) { /* silent */ }
    }

    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* silent */ }
    }

    function loadSections() {
        try {
            const raw = localStorage.getItem(SECTIONS_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                sections = data.sections || [];
                activeSectionId = data.activeSectionId || (sections.length > 0 ? sections[0].id : null);
            }
        } catch (e) { /* silent */ }
    }

    function saveSections() {
        try {
            localStorage.setItem(SECTIONS_KEY, JSON.stringify({
                sections,
                activeSectionId
            }));
        } catch (e) { /* silent */ }
    }

    function getActiveSection() {
        return sections.find(s => s.id === activeSectionId) || null;
    }

    // ===== Theme =====
    function initTheme() {
        if (prefs.darkMode) {
            document.documentElement.removeAttribute('data-theme');
            $('.icon-sun').style.display = '';
            $('.icon-moon').style.display = 'none';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            $('.icon-sun').style.display = 'none';
            $('.icon-moon').style.display = '';
        }
    }

    function toggleTheme() {
        prefs.darkMode = !prefs.darkMode;
        initTheme();
        savePrefs();
    }

    // ===== Toast =====
    function showToast(msg) {
        const toast = $('#toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2800);
    }

    // ===== API Key =====
    function initApiKey() {
        const input = $('#apiKeyInput');
        const toggleBtn = $('#toggleKeyVisibility');

        if (prefs.apiKey) {
            input.value = prefs.apiKey;
        }

        input.addEventListener('input', () => {
            prefs.apiKey = input.value.trim();
            savePrefs();
        });

        toggleBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                toggleBtn.querySelector('.icon-eye').style.display = 'none';
                toggleBtn.querySelector('.icon-eye-off').style.display = '';
            } else {
                input.type = 'password';
                toggleBtn.querySelector('.icon-eye').style.display = '';
                toggleBtn.querySelector('.icon-eye-off').style.display = 'none';
            }
        });
    }

    function getApiKey() {
        return prefs.apiKey || $('#apiKeyInput').value.trim();
    }

    // ===== Particle Background =====
    function initParticles() {
        const canvas = $('#particleCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        const COUNT = 25;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < COUNT; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2.5 + 0.5,
                color: ['rgba(0,212,255,', 'rgba(168,85,247,', 'rgba(236,72,153,', 'rgba(34,197,94,'][Math.floor(Math.random() * 4)],
                alpha: Math.random() * 0.4 + 0.1,
            });
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color + p.alpha + ')';
                ctx.fill();

                for (let j = i + 1; j < particles.length; j++) {
                    const q = particles[j];
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = `rgba(99,102,241,${0.07 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }
        draw();
    }

    // ===== Drop Zone =====
    function initDropZone() {
        const dropZone = $('#dropZone');
        const fileInput = $('#imageUpload');

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change — supports multiple files
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 1) {
                setImage(files[0]);
            } else if (files.length > 1) {
                setMultipleImages(files);
            }
            e.target.value = '';
        });

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length === 1) {
                setImage(files[0]);
            } else if (files.length > 1) {
                setMultipleImages(files);
            } else {
                showToast('⚠️ يرجى إسقاط ملف صورة فقط');
            }
        });

        // Remove image
        $('#removeImageBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            clearImage();
        });

        $('#removeAllImagesBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            clearImage();
        });
    }

    function setImage(fileOrBlob) {
        clearImage();
        currentImageBlobs = [fileOrBlob];
        const url = URL.createObjectURL(fileOrBlob);
        currentImageUrls = [url];

        $('#previewImage').src = url;
        $('#chatImagePreview').style.display = 'inline-block';
        $('#multiImagePreview').style.display = 'none';
        $('#extractBtn').disabled = false;
    }

    function setMultipleImages(files) {
        clearImage();
        currentImageBlobs = files;
        currentImageUrls = files.map(f => URL.createObjectURL(f));

        // Show multi preview
        $('#chatImagePreview').style.display = 'none';
        $('#multiImagePreview').style.display = '';
        $('#multiImageCount').textContent = files.length;

        const thumbs = $('#multiPreviewThumbs');
        thumbs.innerHTML = '';
        currentImageUrls.forEach((url, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'multi-thumb';
            thumb.innerHTML = `<img src="${url}" alt="صورة ${i + 1}"><span class="thumb-number">${i + 1}</span>`;
            thumbs.appendChild(thumb);
        });

        $('#extractBtn').disabled = false;
    }

    function clearImage() {
        currentImageUrls.forEach(url => URL.revokeObjectURL(url));
        currentImageBlobs = [];
        currentImageUrls = [];
        $('#previewImage').src = '';
        $('#chatImagePreview').style.display = 'none';
        $('#multiImagePreview').style.display = 'none';
        $('#extractBtn').disabled = true;
    }

    // ===== Camera =====
    function initCamera() {
        $('#cameraBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            openCamera();
        });
        $('#captureBtn').addEventListener('click', capturePhoto);
        $('#closeCameraBtn').addEventListener('click', closeCamera);
    }

    function openCamera() {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then((stream) => {
                cameraStream = stream;
                const video = $('#cameraVideo');
                video.srcObject = stream;
                $('#cameraContainer').style.display = 'block';
            })
            .catch(() => showToast('⚠️ لا يمكن الوصول للكاميرا'));
    }

    function capturePhoto() {
        const video = $('#cameraVideo');
        const canvas = $('#captureCanvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        closeCamera();
        canvas.toBlob((blob) => {
            setImage(blob);
        }, 'image/jpeg', 0.92);
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        $('#cameraContainer').style.display = 'none';
    }

    // ===== Paste =====
    function initPaste() {
        $('#pasteBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            pasteFromClipboard();
        });

        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob) setImage(blob);
                    break;
                }
            }
        });
    }

    async function pasteFromClipboard() {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        setImage(blob);
                        return;
                    }
                }
            }
            showToast('⚠️ لا توجد صورة في الحافظة');
        } catch (err) {
            showToast('⚠️ لا يمكن الوصول للحافظة — جرب Ctrl+V');
        }
    }

    // ===== Resize Image =====
    function resizeImage(blob, maxSize = 800) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;

                if (width <= maxSize && height <= maxSize) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/jpeg', 0.70).split(',')[1];
                    resolve(base64);
                    return;
                }

                if (width > height) {
                    height = Math.round((height / width) * maxSize);
                    width = maxSize;
                } else {
                    width = Math.round((width / height) * maxSize);
                    height = maxSize;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', 0.70).split(',')[1];
                resolve(base64);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            };

            img.src = url;
        });
    }

    // ===== Chat Message Functions =====
    function addChatMessage(type, content, imageUrl = null) {
        const chatMessages = $('#chatMessages');

        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const now = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${type}-msg`;

        const avatar = type === 'bot' ? '🤖' : '👤';

        let contentHTML = '';

        if (type === 'user' && imageUrl) {
            contentHTML = `<img src="${imageUrl}" alt="صورة مرفوعة"><p>استخرج النص من هذه الصورة 📝</p>`;
        } else if (type === 'user' && content && content.includes('صور')) {
            contentHTML = `<p>${content}</p>`;
        } else if (type === 'bot' && content) {
            const escapedText = escapeHtml(content);
            const uniqueId = 'copy-' + Date.now();
            contentHTML = `
                <div class="extracted-text">${escapedText}</div>
                <button class="copy-extracted" id="${uniqueId}" onclick="window._copyText(this)">
                    📋 نسخ النص
                </button>
            `;
        } else {
            contentHTML = `<p>${content}</p>`;
        }

        bubble.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-content">
                ${contentHTML}
                <span class="chat-time">${now}</span>
            </div>
        `;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return bubble;
    }

    function addLoadingMessage(statusMsg = 'جاري استخراج النص...') {
        const chatMessages = $('#chatMessages');

        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble bot-msg';
        bubble.id = 'loadingBubble';

        bubble.innerHTML = `
            <div class="chat-avatar">🤖</div>
            <div class="chat-content">
                <div class="chat-loading">
                    <span></span><span></span><span></span>
                </div>
                <p style="font-size:0.82rem; color:var(--text-muted); margin-top:4px" id="loadingStatusText">${statusMsg}</p>
            </div>
        `;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return bubble;
    }

    function removeLoadingMessage() {
        const loading = $('#loadingBubble');
        if (loading) loading.remove();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Global copy handler
    window._copyText = function (btn) {
        const textEl = btn.parentElement.querySelector('.extracted-text');
        if (!textEl) return;
        const text = textEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = '✅ تم النسخ!';
            showToast('✅ تم نسخ النص');
            setTimeout(() => { btn.textContent = '📋 نسخ النص'; }, 2000);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            btn.textContent = '✅ تم النسخ!';
            showToast('✅ تم نسخ النص');
            setTimeout(() => { btn.textContent = '📋 نسخ النص'; }, 2000);
        });
    };

    // ===== Extract Text =====
    function initExtract() {
        $('#extractBtn').addEventListener('click', startExtraction);
    }

    function initClearChat() {
        $('#clearChatBtn').addEventListener('click', () => {
            const chatMessages = $('#chatMessages');
            chatMessages.innerHTML = `
                <div class="chat-welcome">
                    <div class="chat-welcome-icon">🤖</div>
                    <p>مرحباً! أنا مساعد الأستاذ 👋</p>
                    <p class="chat-welcome-sub">ارفع صورة أو عدة صور وسأستخرج النص منها فوراً</p>
                </div>
            `;
            showToast('🗑️ تم مسح المحادثة');
        });
    }

    async function startExtraction() {
        if (currentImageBlobs.length === 0) {
            showToast('⚠️ يرجى رفع صورة أولاً');
            return;
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            showToast('⚠️ يرجى إدخال مفتاح API أولاً');
            $('#apiKeyInput').focus();
            return;
        }

        $('#extractBtn').disabled = true;

        const blobs = [...currentImageBlobs];
        const urls = [...currentImageUrls];
        const isBatch = blobs.length > 1;

        // Add user message
        if (isBatch) {
            addChatMessage('user', `📸 استخراج النص من ${blobs.length} صور`);
        } else {
            addChatMessage('user', '', urls[0]);
        }

        clearImage();

        let allExtractedText = '';

        // Process each image
        for (let i = 0; i < blobs.length; i++) {
            const loadingMsg = isBatch
                ? `جاري معالجة الصورة ${i + 1} من ${blobs.length}...`
                : 'جاري استخراج النص...';

            const loadingBubble = addLoadingMessage(loadingMsg);

            try {
                const statusText = $('#loadingStatusText');

                if (statusText) statusText.textContent = '📐 تصغير الصورة...';
                const base64 = await resizeImage(blobs[i]);

                if (statusText) statusText.textContent = '🤖 جاري التحليل بواسطة Gemini AI...';
                const extractedText = await callGeminiVision(base64, apiKey);

                removeLoadingMessage();

                if (extractedText && extractedText.trim().length > 0) {
                    const label = isBatch ? `📄 الصورة ${i + 1}:\n${extractedText.trim()}` : extractedText.trim();
                    addChatMessage('bot', label);
                    allExtractedText += (allExtractedText ? '\n' : '') + extractedText.trim();
                } else {
                    addChatMessage('bot', isBatch
                        ? `⚠️ لم يتم العثور على نص في الصورة ${i + 1}`
                        : '⚠️ لم يتم العثور على نص في الصورة. جرب صورة أوضح.');
                }

            } catch (err) {
                console.error('Extraction error:', err);
                removeLoadingMessage();
                addChatMessage('bot', `❌ حدث خطأ${isBatch ? ` في الصورة ${i + 1}` : ''}: ${err.message || 'فشل استخراج النص'}`);
            }

            // Small delay between batch requests
            if (isBatch && i < blobs.length - 1) {
                await sleep(1000);
            }
        }

        // Show Save Button instead of auto-parsing
        if (allExtractedText.trim().length > 0) {
            const saveBtn = $('#saveOcrBtn');
            saveBtn.style.display = '';

            // Clean up old listeners
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

            newSaveBtn.addEventListener('click', () => {
                parseStudents(allExtractedText.trim());
            });

            showToast(isBatch ? `✅ تم معالجة ${blobs.length} صور بنجاح` : '✅ تم استخراج النص من الصورة');
        }

        $('#extractBtn').disabled = !currentImageBlobs.length;
    }

    // ===== Gemini Vision API =====
    const FALLBACK_MODELS = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-pro-vision'
    ];

    async function getAvailableModels(apiKey) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
            );
            if (!response.ok) return null;
            const data = await response.json();
            const models = (data.models || [])
                .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                .map(m => m.name.replace('models/', ''))
                .filter(m => m.includes('flash') || m.includes('pro'));
            return models.length > 0 ? models : null;
        } catch (e) {
            return null;
        }
    }

    async function callGeminiVision(base64Image, apiKey) {
        const prompt = 'استخرج كل النصوص الموجودة في هذه الصورة بدقة (OCR)';

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                maxOutputTokens: 4096,
            }
        };

        updateLoadingStatus('🔍 جاري البحث عن النماذج المتاحة...');
        const availableModels = await getAvailableModels(apiKey);
        const MODELS = availableModels || FALLBACK_MODELS;

        let lastError = null;
        let errorDetails = [];

        for (let m = 0; m < MODELS.length; m++) {
            const model = MODELS[m];
            const RETRY_WAITS = [2, 5, 10];

            for (let attempt = 0; attempt <= RETRY_WAITS.length; attempt++) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

                try {
                    updateLoadingStatus(`🤖 جاري التحليل بـ ${model}...`);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        return text.trim();
                    }

                    if (response.status === 429) {
                        if (attempt < RETRY_WAITS.length) {
                            const waitSec = RETRY_WAITS[attempt];
                            updateLoadingStatus(`⏳ حد الطلبات على ${model}... إعادة بعد ${waitSec}ث`);
                            await sleep(waitSec * 1000);
                            continue;
                        }
                        errorDetails.push(`${model}: تجاوز حد الطلبات`);
                        lastError = new Error('تم تجاوز الحد الأقصى للطلبات');
                        break;
                    }

                    if (response.status === 404) {
                        errorDetails.push(`${model}: غير متاح`);
                        lastError = new Error(`النموذج ${model} غير متاح`);
                        break;
                    }

                    if (response.status === 400) {
                        throw new Error('مفتاح API غير صالح أو الطلب غير صحيح');
                    } else if (response.status === 403) {
                        throw new Error('مفتاح API لا يملك الصلاحيات المطلوبة');
                    }

                    errorDetails.push(`${model}: خطأ ${response.status}`);
                    throw new Error(`خطأ غير متوقع: ${response.status}`);

                } catch (err) {
                    if (err.message.includes('مفتاح API') || err.message.includes('الصلاحيات')) {
                        throw err;
                    }
                    lastError = err;
                    if (attempt < RETRY_WAITS.length) {
                        await sleep(RETRY_WAITS[attempt] * 1000);
                    }
                }
            }

            if (m < MODELS.length - 1) {
                updateLoadingStatus(`🔄 تجربة نموذج بديل: ${MODELS[m + 1]}...`);
                await sleep(500);
            }
        }

        const details = errorDetails.length > 0
            ? '\n\nتفاصيل:\n' + errorDetails.join('\n')
            : '';
        throw new Error((lastError?.message || 'فشل استخراج النص') + details);
    }

    function updateLoadingStatus(msg) {
        const el = $('#loadingStatusText');
        if (el) el.textContent = msg;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== Section Management =====
    function initSectionManagement() {
        $('#addSectionBtn').addEventListener('click', () => openSectionModal('add'));

        $('#modalCancelBtn').addEventListener('click', closeSectionModal);
        $('#sectionModal').addEventListener('click', (e) => {
            if (e.target === $('#sectionModal')) closeSectionModal();
        });
    }

    function openSectionModal(mode, sectionId = null) {
        const modal = $('#sectionModal');
        const input = $('#sectionNameInput');
        const title = $('#modalTitle');
        const confirmBtn = $('#modalConfirmBtn');

        if (mode === 'add') {
            title.textContent = '➕ إضافة شعبة جديدة';
            confirmBtn.textContent = 'إضافة';
            input.value = '';
        } else {
            title.textContent = '✏️ تعديل اسم الشعبة';
            confirmBtn.textContent = 'تعديل';
            const sec = sections.find(s => s.id === sectionId);
            input.value = sec ? sec.name : '';
        }

        modal.style.display = '';

        // Clean up old listener
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) {
                showToast('⚠️ يرجى إدخال اسم الشعبة');
                return;
            }

            if (mode === 'add') {
                const newSection = {
                    id: 'sec_' + Date.now(),
                    name,
                    students: [],
                    usedStudents: [],
                    absentStudents: []
                };
                sections.push(newSection);
                activeSectionId = newSection.id;
            } else {
                const sec = sections.find(s => s.id === sectionId);
                if (sec) sec.name = name;
            }

            saveSections();
            renderSectionTabs();
            renderStudentList();
            updatePickerUI();
            renderClassesList();
            updateHomeStats();
            closeSectionModal();
            showToast(mode === 'add' ? `✅ تم إضافة صف "${name}"` : `✅ تم تعديل الاسم`);
        });

        setTimeout(() => input.focus(), 100);
    }

    function closeSectionModal() {
        $('#sectionModal').style.display = 'none';
    }

    function renderSectionTabs() {
        const container = $('#sectionTabs');
        container.innerHTML = '';

        sections.forEach(sec => {
            const tab = document.createElement('div');
            tab.className = 'section-tab' + (sec.id === activeSectionId ? ' active' : '');
            tab.innerHTML = `
                <span class="tab-name">${escapeHtml(sec.name)}</span>
                <span class="tab-count">${sec.students.length}</span>
                <div class="tab-actions">
                    <button class="tab-action-btn tab-edit" title="تعديل" data-id="${sec.id}">✏️</button>
                    <button class="tab-action-btn tab-delete" title="حذف" data-id="${sec.id}">🗑️</button>
                </div>
            `;

            // Click to switch
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.tab-action-btn')) return;
                activeSectionId = sec.id;
                saveSections();
                renderSectionTabs();
                renderStudentList();
                updatePickerUI();
                // Reset picker display
                $('#pickerPlaceholder').style.display = '';
                $('#pickerName').style.display = 'none';
            });

            container.appendChild(tab);
        });

        // Attach edit/delete events
        container.querySelectorAll('.tab-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openSectionModal('edit', btn.dataset.id);
            });
        });

        container.querySelectorAll('.tab-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const sec = sections.find(s => s.id === id);
                showConfirmModal('حذف الصف', `هل تريد حذف صف "${sec?.name}"؟`, () => {
                    sections = sections.filter(s => s.id !== id);
                    if (activeSectionId === id) {
                        activeSectionId = sections.length > 0 ? sections[0].id : null;
                    }
                    saveSections();
                    if (sections.length === 0) {
                        updatePickerVisibility();
                    } else {
                        renderSectionTabs();
                        renderStudentList();
                        updatePickerUI();
                    }
                    showToast('🗑️ تم حذف الصف');
                });
            });
        });
    }

    // ===== Student Picker =====
    function initStudentPicker() {
        $('#pickBtn').addEventListener('click', pickRandomStudent);
        $('#resetStudentsBtn').addEventListener('click', resetStudents);
        $('#toggleAbsentMode').addEventListener('click', () => {
            absentMode = !absentMode;
            const btn = $('#toggleAbsentMode');
            if (absentMode) {
                btn.innerHTML = '✅ إنهاء وضع الغياب';
                btn.classList.add('active');
            } else {
                btn.innerHTML = '❌ تسجيل الغياب';
                btn.classList.remove('active');
            }
            renderStudentList();
        });
    }

    function parseStudents(text) {
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.length < 100);

        if (lines.length === 0) return;

        // Create or update active section
        if (sections.length === 0 || !activeSectionId) {
            const newSection = {
                id: 'sec_' + Date.now(),
                name: 'شعبة جديدة',
                students: lines,
                usedStudents: [],
                absentStudents: []
            };
            sections.push(newSection);
            activeSectionId = newSection.id;
        } else {
            const sec = getActiveSection();
            if (sec) {
                // Add new unique students
                const existing = new Set(sec.students);
                let added = 0;
                lines.forEach(name => {
                    if (!existing.has(name)) {
                        sec.students.push(name);
                        existing.add(name);
                        added++;
                    }
                });
                if (added === 0) {
                    showToast('⚠️ جميع الطلاب المستخرجين موجودون مسبقاً في هذا الصف');
                } else if (added < lines.length) {
                    showToast(`✅ تم إضافة ${added} طلاب جدد. تم تجاهل الأسماء المكررة`);
                }
            }
        }

        saveSections();

        // Hide Save button
        $('#saveOcrBtn').style.display = 'none';

        // Navigate to picker view
        navigateTo('viewPicker');

        showToast(`📋 تم تحميل ${lines.length} طالب`);
    }

    function pickRandomStudent() {
        const sec = getActiveSection();
        if (!sec) return;

        const available = sec.students.filter(s =>
            !sec.usedStudents.includes(s) && !sec.absentStudents.includes(s)
        );

        if (available.length === 0) {
            showToast('⚠️ تم اختيار جميع الطلاب! اضغط إعادة تعيين');
            return;
        }

        $('#pickBtn').disabled = true;

        const nameEl = $('#selectedName');
        const pickerName = $('#pickerName');
        const placeholder = $('#pickerPlaceholder');

        placeholder.style.display = 'none';
        pickerName.style.display = '';

        let shuffleCount = 0;
        const totalShuffles = 15;
        const shuffleInterval = setInterval(() => {
            const randomIdx = Math.floor(Math.random() * available.length);
            nameEl.textContent = available[randomIdx];
            nameEl.style.opacity = '0.5';
            nameEl.style.animation = 'none';
            shuffleCount++;

            if (shuffleCount >= totalShuffles) {
                clearInterval(shuffleInterval);

                const finalIdx = Math.floor(Math.random() * available.length);
                const chosen = available[finalIdx];
                sec.usedStudents.push(chosen);
                saveSections();

                nameEl.textContent = chosen;
                nameEl.style.opacity = '1';
                nameEl.style.animation = 'none';
                nameEl.offsetHeight; // force reflow
                nameEl.style.animation = 'revealName 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both';

                renderStudentList(chosen);
                updatePickerUI();
                $('#pickBtn').disabled = false;




                // 🎉 Confetti
                launchConfetti();

                showToast(`🎯 تم اختيار: ${chosen}`);
            }
        }, 70);
    }

    function resetStudents() {
        const sec = getActiveSection();
        if (!sec) return;

        sec.usedStudents = [];
        saveSections();
        renderStudentList();
        updatePickerUI();

        $('#pickerPlaceholder').style.display = '';
        $('#pickerName').style.display = 'none';

        showToast('🔄 تم إعادة تعيين القائمة');
    }

    function renderStudentList(justPicked = null) {
        const container = $('#studentChips');
        container.innerHTML = '';

        const sec = getActiveSection();
        if (!sec) return;

        sec.students.forEach((name, idx) => {
            const chip = document.createElement('div');
            const isUsed = sec.usedStudents.includes(name);
            const isAbsent = sec.absentStudents.includes(name);
            let classes = 'student-chip';
            if (isUsed) classes += ' used';
            if (isAbsent) classes += ' absent';
            if (name === justPicked) classes += ' just-picked';
            chip.className = classes;
            chip.style.animationDelay = `${idx * 0.03}s`;

            const absentBtn = absentMode
                ? `<button class="chip-absent-btn ${isAbsent ? 'is-absent' : ''}" data-name="${escapeHtml(name)}" title="${isAbsent ? 'إلغاء الغياب' : 'تسجيل غائب'}">
                     ${isAbsent ? '✅' : '❌'}
                   </button>`
                : (isAbsent ? '<span class="chip-absent-badge">غائب</span>' : '');

            chip.innerHTML = `
                <span class="chip-number">${idx + 1}</span>
                <span class="chip-name">${escapeHtml(name)}</span>
                ${absentBtn}
            `;

            container.appendChild(chip);
        });

        // Attach absent button events
        if (absentMode) {
            container.querySelectorAll('.chip-absent-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const studentName = btn.dataset.name;
                    toggleAbsent(studentName);
                });
            });
        }
    }

    function toggleAbsent(name) {
        const sec = getActiveSection();
        if (!sec) return;

        const idx = sec.absentStudents.indexOf(name);
        if (idx >= 0) {
            sec.absentStudents.splice(idx, 1);
            showToast(`✅ ${name} — حاضر`);
        } else {
            sec.absentStudents.push(name);
            showToast(`❌ ${name} — غائب`);
        }

        saveSections();
        renderStudentList();
        updatePickerUI();
    }

    function updatePickerUI() {
        const sec = getActiveSection();
        if (!sec) return;

        const available = sec.students.filter(s =>
            !sec.usedStudents.includes(s) && !sec.absentStudents.includes(s)
        );
        const totalActive = sec.students.length - sec.absentStudents.length;

        $('#remainingCount').textContent = available.length;
        $('#totalCount').textContent = totalActive;
        $('#pickBtn').disabled = available.length === 0;

        if (available.length === 0 && sec.students.length > 0) {
            $('#pickBtn').textContent = '✅ تم اختيار جميع الطلاب';
        } else {
            $('#pickBtn').innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                    <path d="M18 4l-1 1.5-3-2L12 6l-2-2.5L7 5.5 6 4"/>
                    <path d="M2 12h2m16 0h2M12 2v2m0 16v2"/>
                    <circle cx="12" cy="12" r="4"/>
                </svg>
                اختر طالب عشوائياً
            `;
        }
    }

    // ===== Text-to-Speech =====
    function speakName(name) {
        if (!('speechSynthesis' in window)) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(name);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.volume = 1;

        // Try to find Arabic voice
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) {
            utterance.voice = arabicVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    // Load voices (they load async in some browsers)
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }

    // ===== Confetti Effect =====
    function launchConfetti() {
        const canvas = $('#confettiCanvas');
        if (!canvas) return;

        const pickerSection = $('#studentPickerSection');
        canvas.width = pickerSection.offsetWidth;
        canvas.height = pickerSection.offsetHeight;
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        const particles = [];
        const colors = ['#00d4ff', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#6366f1'];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 100,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 1) * 10 - 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 3,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                life: 1,
                decay: 0.012 + Math.random() * 0.01
            });
        }

        let animId;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            particles.forEach(p => {
                if (p.life <= 0) return;
                alive = true;

                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.25;
                p.rotation += p.rotSpeed;
                p.life -= p.decay;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            });

            if (alive) {
                animId = requestAnimationFrame(animate);
            } else {
                canvas.style.display = 'none';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        animate();
    }

    // ===== PWA Install =====
    let deferredPrompt = null;

    function initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            $('#pwaInstallBanner').style.display = '';
        });

        const installBtn = $('#pwaInstallBtn');
        const dismissBtn = $('#pwaDismissBtn');

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;
                if (result.outcome === 'accepted') {
                    showToast('✅ تم تثبيت التطبيق!');
                }
                deferredPrompt = null;
                $('#pwaInstallBanner').style.display = 'none';
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                $('#pwaInstallBanner').style.display = 'none';
            });
        }
    }

    // ===== Splash Screen =====
    function initSplash() {
        const today = new Date().toDateString();
        const lastSplash = localStorage.getItem('lastSplashDate');

        const splash = $('#splashScreen');
        if (!splash) return;

        if (lastSplash === today) {
            // Already shown today, hide immediately
            splash.style.display = 'none';
            $('#appContainer').style.display = '';
            $('#bottomNav').style.display = '';
            splash.remove();
        } else {
            // Show splash
            localStorage.setItem('lastSplashDate', today);
            setTimeout(() => {
                splash.classList.add('hide');
                $('#appContainer').style.display = '';
                $('#bottomNav').style.display = '';
                setTimeout(() => splash.remove(), 500);
            }, 2500);
        }
    }

    // ===== View Navigation =====
    function initViews() {
        // Bottom nav
        $$('.bottom-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                navigateTo(btn.dataset.view);
            });
        });

        // Home cards
        $$('.home-card').forEach(card => {
            card.addEventListener('click', () => {
                navigateTo(card.dataset.view);
            });
        });

        // Back button
        $('#backBtn').addEventListener('click', () => {
            navigateTo('viewHome');
        });

        // Go to classes from picker
        const goBtn = $('#goToClassesBtn');
        if (goBtn) {
            goBtn.addEventListener('click', () => navigateTo('viewClasses'));
        }
    }

    function navigateTo(viewId) {
        // Hide all views
        $$('.view').forEach(v => v.style.display = 'none');

        // Show target view
        const target = $('#' + viewId);
        if (target) {
            target.style.display = '';
            // Re-trigger animation
            target.style.animation = 'none';
            target.offsetHeight;
            target.style.animation = 'viewIn 0.35s ease-out';
        }

        currentView = viewId;
        updateBottomNav();
        updateHeader();

        // Special: update classes or picker view when navigating
        if (viewId === 'viewClasses') {
            renderClassesList();
        }
        if (viewId === 'viewPicker') {
            updatePickerVisibility();
            if (sections.length > 0) {
                renderSectionTabs();
                renderStudentList();
                updatePickerUI();
            }
        }
        if (viewId === 'viewHome') {
            updateHomeStats();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateBottomNav() {
        $$('.bottom-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === currentView);
        });
    }

    function updateHeader() {
        const titles = VIEW_TITLES[currentView] || VIEW_TITLES.viewHome;
        $('#headerTitle').textContent = titles[0];
        $('#headerSubtitle').textContent = titles[1];
        $('#backBtn').style.display = currentView === 'viewHome' ? 'none' : '';
    }

    function updateHomeStats() {
        const totalStudents = sections.reduce((sum, s) => sum + s.students.length, 0);
        if (sections.length > 0) {
            $('#homeStats').style.display = '';
            $('#statSections').textContent = sections.length;
            $('#statStudents').textContent = totalStudents;
        } else {
            $('#homeStats').style.display = 'none';
        }
    }

    function updatePickerVisibility() {
        const hasS = sections.length > 0 && sections.some(s => s.students.length > 0);
        const noSec = $('#pickerNoSections');
        const content = $('#pickerContent');
        if (noSec) noSec.style.display = hasS ? 'none' : '';
        if (content) content.style.display = hasS ? '' : 'none';
    }

    // ===== Custom Modals Helper =====
    function showConfirmModal(title, text, onConfirm) {
        const modal = $('#confirmModal');
        $('#confirmModalTitle').textContent = title;
        $('#confirmModalText').textContent = text;

        const yesBtn = $('#confirmModalYesBtn');
        const newYesBtn = yesBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

        newYesBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (onConfirm) onConfirm();
        });

        const noBtn = $('#confirmModalNoBtn');
        const newNoBtn = noBtn.cloneNode(true);
        noBtn.parentNode.replaceChild(newNoBtn, noBtn);

        newNoBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.style.display = '';
    }

    // ===== Classes View =====
    function renderClassesList() {
        const list = $('#sectionList');
        const empty = $('#classesEmpty');
        if (!list) return;

        if (sections.length === 0) {
            empty.style.display = '';
            list.innerHTML = '';
            return;
        }

        empty.style.display = 'none';
        list.innerHTML = '';

        sections.forEach((sec, idx) => {
            const item = document.createElement('div');
            item.className = 'section-list-item';
            item.style.animationDelay = `${idx * 0.07}s`;

            // Random distinct color and initial for icon
            const colorIndex = (idx % 5) + 1;
            const initial = sec.name.trim().charAt(0) || '📚';

            item.innerHTML = `
                <div class="section-item-icon" style="background: var(--class-color-${colorIndex})">${escapeHtml(initial)}</div>
                <div class="section-item-info">
                    <h4>${escapeHtml(sec.name)}</h4>
                    <span>${sec.students.length} طالب</span>
                </div>
                <div class="section-item-actions">
                    <button title="استخراج من صورة" data-action="ocr" data-id="${sec.id}">📸</button>
                    <button title="إضافة طلاب يدوياً" data-action="manual" data-id="${sec.id}">✏️</button>
                    <button title="تعديل الاسم" data-action="edit" data-id="${sec.id}">📝</button>
                    <button title="حذف" data-action="delete" data-id="${sec.id}">🗑️</button>
                </div>
            `;
            list.appendChild(item);
        });

        // Attach events
        list.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => openSectionModal('edit', btn.dataset.id));
        });

        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sec = sections.find(s => s.id === btn.dataset.id);
                showConfirmModal('حذف الصف', `هل أنت متأكد من حذف صف "${sec?.name}" وجميع طلابه؟`, () => {
                    sections = sections.filter(s => s.id !== btn.dataset.id);
                    if (activeSectionId === btn.dataset.id) {
                        activeSectionId = sections.length > 0 ? sections[0].id : null;
                    }
                    saveSections();
                    renderClassesList();
                    showToast('🗑️ تم حذف الصف');
                });
            });
        });

        list.querySelectorAll('[data-action="manual"]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeSectionId = btn.dataset.id;
                saveSections();
                $('#manualEntrySection').style.display = '';
                const sec = getActiveSection();
                $('#manualStudentInput').placeholder = `إضافة طلاب لـ "${sec?.name}"...\nاكتب اسم كل طالب في سطر منفصل`;
                $('#manualStudentInput').value = '';
                setTimeout(() => {
                    $('#manualEntrySection').scrollIntoView({ behavior: 'smooth' });
                    $('#manualStudentInput').focus();
                }, 200);
            });
        });

        list.querySelectorAll('[data-action="ocr"]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeSectionId = btn.dataset.id;
                saveSections();
                const sec = getActiveSection();
                navigateTo('viewOCR');
                showToast(`📸 يرجى رفع صورة لاستخراج الطلاب لصف "${sec?.name}"`);
            });
        });
    }

    // ===== Manual Student Entry =====
    function initManualEntry() {
        const addBtn = $('#addManualStudentsBtn');
        const cancelBtn = $('#cancelManualBtn');

        if (addBtn) {
            addBtn.addEventListener('click', addManualStudents);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                $('#manualEntrySection').style.display = 'none';
                $('#manualStudentInput').value = '';
            });
        }
    }

    function addManualStudents() {
        const input = $('#manualStudentInput');
        const text = input.value.trim();
        if (!text) {
            showToast('\u26a0\ufe0f \u0627\u0643\u062a\u0628 \u0627\u0633\u0645 \u0637\u0627\u0644\u0628 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644');
            return;
        }

        const names = text.split('\n')
            .map(n => n.trim())
            .filter(n => n.length > 0 && n.length < 100);

        if (names.length === 0) {
            showToast('\u26a0\ufe0f \u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0623\u0633\u0645\u0627\u0621');
            return;
        }

        // If no active section, create one
        if (!activeSectionId || !getActiveSection()) {
            const newSection = {
                id: 'sec_' + Date.now(),
                name: '\u0635\u0641 \u062c\u062f\u064a\u062f',
                students: [],
                usedStudents: [],
                absentStudents: []
            };
            sections.push(newSection);
            activeSectionId = newSection.id;
        }

        const sec = getActiveSection();
        if (sec) {
            // Add new names (avoid duplicates)
            const existing = new Set(sec.students);
            let added = 0;
            names.forEach(name => {
                if (!existing.has(name)) {
                    sec.students.push(name);
                    existing.add(name);
                    added++;
                }
            });

            saveSections();
            renderClassesList();
            input.value = '';
            $('#manualEntrySection').style.display = 'none';
            showToast(`\u2705 \u062a\u0645 \u0625\u0636\u0627\u0641\u0629 ${added} \u0637\u0627\u0644\u0628 \u0625\u0644\u0649 "${sec.name}"`);
        }
    }

    // ===== Start =====
    document.addEventListener('DOMContentLoaded', init);
})();
