// ZenTab 1.4 - High Performance & Aesthetic Dashboard

// Icons dictionary
const ICONS = [
    '📁', '🔗', '⭐', '⚡', '🚀', '💻', '🎨', '🛠️', '📝', '🧠',
    '💼', '🏠', '📺', '🎮', '🎵', '📸', '🛒', '✈️', '🌍', '❤️',
    '💡', '🔍', '📱', '🔋', '📫', '📊', '🛡️', '⚙️', '✨', '🪐'
];

function getRandomIcon() {
    return ICONS[Math.floor(Math.random() * ICONS.length)];
}

// State management
let sections = [];
let dragSrcEl = null;
let currentTheme = 'dark';
let settings = {
    is12Hour: false,
    showDate: true,
    showGreeting: true,
    bgBlur: 0,
    bgDim: 30
};

let confirmCallbackYes = null;
let confirmCallbackCancel = null;

// DOM Elements Cache
const clockElement = document.getElementById('clock');
const dateBadgeElement = document.getElementById('date-badge');
const greetingElement = document.getElementById('greeting');
const sectionsContainer = document.getElementById('sections-container');
const addSectionBtn = document.getElementById('add-section-btn');
const saveSectionBtn = document.getElementById('save-section-btn');
const saveLinkBtn = document.getElementById('save-link-btn');
const quickThemeToggle = document.getElementById('quick-theme-toggle');

const sectionModalTitle = document.getElementById('section-modal-title');
const sectionNameInput = document.getElementById('section-name');
const sectionIconInput = document.getElementById('section-icon');
const sectionIdEdit = document.getElementById('section-id-edit');
const iconPicker = document.getElementById('icon-picker');

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const closeSidebarBtn = document.getElementById('close-sidebar');
const tabsList = document.getElementById('tabs-list');
const refreshTabsBtn = document.getElementById('refresh-tabs');
const searchInput = document.getElementById('search-input');
const shortcutBadge = document.getElementById('search-shortcut-badge');

// Favicon Helper: Native Chrome Cached Favicon API with Monogram Fallback
function getFaviconUrl(url, size = 32) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        try {
            const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
            faviconUrl.searchParams.set('pageUrl', url);
            faviconUrl.searchParams.set('size', size.toString());
            return faviconUrl.toString();
        } catch {
            // fallback below
        }
    }
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
    } catch {
        return '';
    }
}

function getMonogram(name, url) {
    const text = (name || url || 'W').trim();
    const initial = text.charAt(0).toUpperCase();
    const hues = [260, 290, 210, 330, 160, 25, 190, 240];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
    }
    const hue = hues[Math.abs(hash) % hues.length];
    return {
        initial,
        style: `background: linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 80%, 45%));`
    };
}

function isDuplicateUrl(url) {
    const normalize = (u) => u.replace(/\/$/, '').toLowerCase();
    const normalizedUrl = normalize(url);

    return sections.some(section =>
        section.links && section.links.some(link => normalize(link.url) === normalizedUrl)
    );
}

// 0ms Cache-First Data Loading
function loadInitialCache() {
    try {
        const cachedSections = localStorage.getItem('zenTabSections');
        if (cachedSections) {
            sections = JSON.parse(cachedSections);
            renderSections();
        }

        const savedTheme = localStorage.getItem('zenTabTheme') || 'dark';
        applyTheme(savedTheme, false);

        const savedSettings = localStorage.getItem('zenTabSettings');
        if (savedSettings) {
            settings = { ...settings, ...JSON.parse(savedSettings) };
            applySettingsToUI();
        }
    } catch (e) {
        console.error('Error loading local cache snapshot', e);
    }
}

function loadData() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['sections', 'theme', 'settings'], (result) => {
            let changed = false;
            if (result.sections) {
                sections = result.sections.map(s => ({
                    ...s,
                    icon: s.icon || getRandomIcon()
                }));
                localStorage.setItem('zenTabSections', JSON.stringify(sections));
                changed = true;
            }
            if (result.theme) {
                applyTheme(result.theme, false);
            }
            if (result.settings) {
                settings = { ...settings, ...result.settings };
                applySettingsToUI();
            }
            if (changed) renderSections();
        });
    } else {
        if (!sections || sections.length === 0) {
            const saved = localStorage.getItem('zenTabSections');
            sections = saved ? JSON.parse(saved) : getDefaultSections();
            saveData();
            renderSections();
        }
    }
}

function getDefaultSections() {
    return [
        {
            name: 'Quick Access',
            icon: '⚡',
            links: [
                { name: 'Google', url: 'https://www.google.com' },
                { name: 'GitHub', url: 'https://github.com' },
                { name: 'YouTube', url: 'https://www.youtube.com' }
            ]
        },
        {
            name: 'Tools & Dev',
            icon: '🛠️',
            links: [
                { name: 'ChatGPT', url: 'https://chatgpt.com' },
                { name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
                { name: 'Stack Overflow', url: 'https://stackoverflow.com' }
            ]
        }
    ];
}

function saveData() {
    try {
        localStorage.setItem('zenTabSections', JSON.stringify(sections));
    } catch (e) {
        console.warn('LocalStorage save failed:', e);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ sections });
    }
}

function saveSettings() {
    try {
        localStorage.setItem('zenTabSettings', JSON.stringify(settings));
    } catch (e) {
        console.warn('LocalStorage settings save failed:', e);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ settings });
    }
}

// High-Performance DocumentFragment Rendering
function renderSections() {
    if (!sectionsContainer) return;

    const fragment = document.createDocumentFragment();

    sections.forEach((section, index) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-card';
        sectionEl.setAttribute('draggable', 'true');
        sectionEl.dataset.type = 'section';
        sectionEl.dataset.index = index;

        const linksListHtml = (section.links || []).map((link, linkIndex) => {
            let hostname = '';
            try {
                hostname = new URL(link.url).hostname.replace(/^www\./, '');
            } catch {
                hostname = link.url;
            }

            const faviconUrl = getFaviconUrl(link.url, 32);
            const monogram = getMonogram(link.name, link.url);

            return `
                <div class="link-item-wrapper" draggable="true" data-type="link" data-section="${index}" data-link="${linkIndex}">
                    <a href="${escapeHtml(link.url)}" class="link-item" title="${escapeHtml(link.name)} (${escapeHtml(hostname)})">
                        <div class="link-favicon-wrap">
                            <img src="${escapeHtml(faviconUrl)}" class="link-favicon" alt="" loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="favicon-monogram" style="${monogram.style} display: none;">${monogram.initial}</div>
                        </div>
                        <div class="link-info">
                            <span class="link-name">${escapeHtml(link.name)}</span>
                            <span class="link-url">${escapeHtml(hostname)}</span>
                        </div>
                    </a>
                    <button class="link-delete-btn" data-action="delete-link" data-section="${index}" data-link="${linkIndex}" title="Remove link">&times;</button>
                </div>
            `;
        }).join('');

        sectionEl.innerHTML = `
            <div class="section-header">
                <div class="section-title-container">
                    <span class="section-icon">${section.icon || '📁'}</span>
                    <h2 class="section-title" title="${escapeHtml(section.name)}">${escapeHtml(section.name)}</h2>
                </div>
                <div class="header-actions">
                    <button class="action-icon-btn" data-action="edit-section" data-index="${index}" title="Edit Section">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
                    </button>
                    <button class="action-icon-btn btn-delete" data-action="delete-section" data-index="${index}" title="Delete Section">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="links-list" data-section-index="${index}">
                ${linksListHtml}
            </div>
            <button class="btn-add-link" data-action="open-link-modal" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="M12 5v14"/>
                </svg>
                <span>Add Link</span>
            </button>
        `;

        fragment.appendChild(sectionEl);
    });

    sectionsContainer.innerHTML = '';
    sectionsContainer.appendChild(fragment);

    setupDragAndDrop();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Drag and Drop Logic
function setupDragAndDrop() {
    const sectionEls = document.querySelectorAll('.section-card');
    const linkEls = document.querySelectorAll('.link-item-wrapper');
    const linkLists = document.querySelectorAll('.links-list');

    sectionEls.forEach(s => addDnDHandlers(s));
    linkEls.forEach(l => addDnDHandlers(l));

    linkLists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            if (dragSrcEl && dragSrcEl.dataset.type === 'link') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                list.classList.add('drag-over');
            }
        });
        list.addEventListener('dragleave', () => {
            list.classList.remove('drag-over');
        });
        list.addEventListener('drop', handleDropOnList);
    });
}

function addDnDHandlers(elem) {
    elem.addEventListener('dragstart', handleDragStart);
    elem.addEventListener('dragover', handleDragOver);
    elem.addEventListener('dragleave', handleDragLeave);
    elem.addEventListener('drop', handleDrop);
    elem.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    e.stopPropagation();
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragSrcEl === this) return;

    if (dragSrcEl && dragSrcEl.dataset.type === this.dataset.type) {
        this.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');

    if (!dragSrcEl || dragSrcEl === this) return;

    const srcType = dragSrcEl.dataset.type;
    const destType = this.dataset.type;

    if (srcType !== destType) return;

    if (srcType === 'section') {
        const srcIndex = parseInt(dragSrcEl.dataset.index);
        const destIndex = parseInt(this.dataset.index);
        const item = sections.splice(srcIndex, 1)[0];
        sections.splice(destIndex, 0, item);
    } else if (srcType === 'link') {
        const srcSection = parseInt(dragSrcEl.dataset.section);
        const srcLink = parseInt(dragSrcEl.dataset.link);
        const destSection = parseInt(this.dataset.section);
        const destLink = parseInt(this.dataset.link);

        const item = sections[srcSection].links.splice(srcLink, 1)[0];
        sections[destSection].links.splice(destLink, 0, item);
    }

    saveData();
    renderSections();
}

function handleDropOnList(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');

    if (!dragSrcEl || dragSrcEl.dataset.type !== 'link') return;

    const srcSection = parseInt(dragSrcEl.dataset.section);
    const srcLink = parseInt(dragSrcEl.dataset.link);
    const destSectionIdx = parseInt(this.dataset.sectionIndex);

    if (srcSection === destSectionIdx) return;

    const item = sections[srcSection].links.splice(srcLink, 1)[0];
    if (!sections[destSectionIdx].links) sections[destSectionIdx].links = [];
    sections[destSectionIdx].links.push(item);

    saveData();
    renderSections();
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

// Spotlight Search & Command Engine
function initSearch() {
    if (!searchInput) return;

    if (shortcutBadge) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        shortcutBadge.textContent = isMac ? '⌘K' : 'Ctrl K';
    }

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (e.key === '/' && document.activeElement !== searchInput && !isInputActive()) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        } else if (e.key === 'Escape') {
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                filterContent('');
                searchInput.blur();
            } else {
                closeAllModals();
                closeSidebar();
            }
        }
    });

    searchInput.addEventListener('input', (e) => {
        const raw = e.target.value;
        const query = raw.toLowerCase().trim();
        filterContent(query);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const raw = searchInput.value.trim();
            if (!raw) return;

            const prefixes = [
                { prefix: ':yt', searchUrl: 'https://www.youtube.com/results?search_query=' },
                { prefix: ':gh', searchUrl: 'https://github.com/search?q=' },
                { prefix: ':w', searchUrl: 'https://en.wikipedia.org/wiki/Special:Search?search=' },
                { prefix: ':r', searchUrl: 'https://www.reddit.com/search/?q=' },
                { prefix: ':ddg', searchUrl: 'https://duckduckgo.com/?q=' }
            ];

            for (const item of prefixes) {
                if (raw.toLowerCase().startsWith(item.prefix)) {
                    const q = raw.slice(item.prefix.length).trim();
                    if (q) {
                        window.location.href = item.searchUrl + encodeURIComponent(q);
                        return;
                    }
                }
            }

            if (raw.match(/^(http|https):\/\/[^ "]+$/) || raw.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(\/[^ "]*)*$/)) {
                let url = raw;
                if (!url.startsWith('http')) url = 'https://' + url;
                window.location.href = url;
                return;
            }

            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
        }
    });

    const chips = document.querySelectorAll('.engine-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prefix = chip.dataset.prefix;
            searchInput.value = prefix;
            searchInput.focus();
        });
    });
}

function isInputActive() {
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function filterContent(query) {
    if (query.startsWith(':')) {
        document.querySelectorAll('.section-card').forEach(s => s.style.display = '');
        document.querySelectorAll('.link-item-wrapper').forEach(l => l.style.display = '');
        return;
    }

    const sectionCards = document.querySelectorAll('.section-card');

    sectionCards.forEach(section => {
        const titleEl = section.querySelector('.section-title');
        const sectionTitle = titleEl ? titleEl.textContent.toLowerCase() : '';
        const links = section.querySelectorAll('.link-item-wrapper');
        let hasLinkMatch = false;

        if (sectionTitle.includes(query)) {
            hasLinkMatch = true;
            links.forEach(l => l.style.display = '');
        } else {
            links.forEach(link => {
                const nameEl = link.querySelector('.link-name');
                const urlEl = link.querySelector('.link-url');
                const name = nameEl ? nameEl.textContent.toLowerCase() : '';
                const url = urlEl ? urlEl.textContent.toLowerCase() : '';

                if (name.includes(query) || url.includes(query)) {
                    link.style.display = '';
                    hasLinkMatch = true;
                } else {
                    link.style.display = 'none';
                }
            });
        }

        section.style.display = hasLinkMatch ? '' : 'none';
    });
}

// Clock, Date & Greeting
function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');

    if (clockElement) {
        if (settings.is12Hour) {
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            clockElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        } else {
            clockElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes}`;
        }
    }

    if (dateBadgeElement && settings.showDate) {
        const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
        dateBadgeElement.textContent = now.toLocaleDateString(undefined, options);
        dateBadgeElement.style.display = 'inline-flex';
    } else if (dateBadgeElement) {
        dateBadgeElement.style.display = 'none';
    }

    if (greetingElement && settings.showGreeting) {
        const rawHours = now.getHours();
        let greet = 'Good evening';
        if (rawHours < 12) greet = 'Good morning';
        else if (rawHours < 18) greet = 'Good afternoon';
        greetingElement.textContent = greet;
        greetingElement.style.display = 'block';
    } else if (greetingElement) {
        greetingElement.style.display = 'none';
    }
}

// Theme System & Presets
function initTheme() {
    if (quickThemeToggle) {
        quickThemeToggle.addEventListener('click', () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const nextTheme = isLight ? (currentTheme === 'light' ? 'dark' : currentTheme) : 'light';
            applyTheme(nextTheme, true);
        });
    }

    const presetCards = document.querySelectorAll('.theme-preset-card');
    presetCards.forEach(card => {
        card.addEventListener('click', () => {
            const preset = card.dataset.preset;
            applyTheme(preset, true);
        });
    });
}

function applyTheme(theme, save = true) {
    if (!theme) theme = 'dark';
    currentTheme = theme;

    if (theme === 'dark') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }

    document.querySelectorAll('.theme-preset-card').forEach(card => {
        if (card.dataset.preset === theme) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    if (save) {
        localStorage.setItem('zenTabTheme', theme);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ theme });
        }
    }
}

// Sidebar & Open Tabs Logic
function initSidebar() {
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeSidebar);
    }
    if (refreshTabsBtn) {
        refreshTabsBtn.addEventListener('click', fetchOpenTabs);
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 't' || e.key === 'T')) {
            e.preventDefault();
            toggleSidebar();
        }
    });
}

function toggleSidebar() {
    if (sidebar.classList.contains('active')) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    sidebar.classList.add('active');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    fetchOpenTabs();
}

function closeSidebar() {
    sidebar.classList.remove('active');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

async function fetchOpenTabs() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
            renderTabs(tabs);
        });
    } else {
        const mockTabs = [
            { title: 'Google Search', url: 'https://google.com' },
            { title: 'GitHub: Let’s build from here', url: 'https://github.com' },
            { title: 'YouTube', url: 'https://youtube.com' }
        ];
        renderTabs(mockTabs);
    }
}

function renderTabs(tabs) {
    if (!tabsList) return;
    tabsList.innerHTML = '';

    const filtered = (tabs || []).filter(tab => {
        if (!tab || !tab.url) return false;
        return !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('brave://') &&
            !tab.url.startsWith('about:');
    });

    if (filtered.length === 0) {
        tabsList.innerHTML = '<p style="text-align:center; opacity:0.5; margin-top:20px; font-size: 0.85rem;">No external tabs open</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(tab => {
        let domain = '';
        try {
            domain = new URL(tab.url).hostname.replace(/^www\./, '');
        } catch {
            domain = tab.url;
        }

        const tabEl = document.createElement('div');
        tabEl.className = 'tab-item';
        tabEl.innerHTML = `
            <div class="tab-info">
                <span class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
                <span class="tab-url">${escapeHtml(domain)}</span>
            </div>
            <button class="btn-add-tab" data-url="${escapeHtml(tab.url)}" data-title="${escapeHtml(tab.title)}">+ Pin</button>
        `;
        fragment.appendChild(tabEl);
    });

    tabsList.appendChild(fragment);

    tabsList.querySelectorAll('.btn-add-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            const title = e.target.dataset.title;
            showSectionPickerForTab(url, title);
        });
    });
}

function showSectionPickerForTab(url, title) {
    const existingSelect = document.getElementById('existing-section-select');
    const newSectionInput = document.getElementById('new-section-name');
    const urlInput = document.getElementById('tab-to-add-url');
    const titleInput = document.getElementById('tab-to-add-title');

    newSectionInput.value = '';
    urlInput.value = url;
    titleInput.value = title;

    existingSelect.innerHTML = '<option value="">-- Select Section --</option>';
    sections.forEach((s, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = s.name;
        existingSelect.appendChild(opt);
    });

    openModal('tab-picker-modal');
}

// Icon Picker Grid
function renderIconPicker() {
    if (!iconPicker) return;
    iconPicker.innerHTML = ICONS.map(icon => `
        <div class="icon-item" data-icon="${icon}">${icon}</div>
    `).join('');

    iconPicker.addEventListener('click', (e) => {
        const target = e.target.closest('.icon-item');
        if (target) {
            document.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
            target.classList.add('selected');
            if (sectionIconInput) sectionIconInput.value = target.dataset.icon;
        }
    });
}

function selectIconInPicker(icon) {
    document.querySelectorAll('.icon-item').forEach(el => {
        if (el.dataset.icon === icon) {
            el.classList.add('selected');
            if (sectionIconInput) sectionIconInput.value = icon;
        } else {
            el.classList.remove('selected');
        }
    });
}

// Settings and Customization
function initSettings() {
    const settingsBtn = document.getElementById('settings-toggle');
    const closeSettings = document.getElementById('close-settings-btn');
    const is12HourToggle = document.getElementById('setting-12hour');
    const showDateToggle = document.getElementById('setting-show-date');
    const showGreetingToggle = document.getElementById('setting-show-greeting');

    const bgUpload = document.getElementById('bg-upload');
    const resetBgBtn = document.getElementById('reset-bg-btn');
    const bgBlurSlider = document.getElementById('bg-blur-slider');
    const bgDimSlider = document.getElementById('bg-dim-slider');
    const bgBlurVal = document.getElementById('bg-blur-val');
    const bgDimVal = document.getElementById('bg-dim-val');

    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    if (closeSettings) closeSettings.addEventListener('click', () => closeModal('settings-modal'));

    if (is12HourToggle) {
        is12HourToggle.checked = !!settings.is12Hour;
        is12HourToggle.addEventListener('change', (e) => {
            settings.is12Hour = e.target.checked;
            saveSettings();
            updateTime();
        });
    }

    if (showDateToggle) {
        showDateToggle.checked = settings.showDate !== false;
        showDateToggle.addEventListener('change', (e) => {
            settings.showDate = e.target.checked;
            saveSettings();
            updateTime();
        });
    }

    if (showGreetingToggle) {
        showGreetingToggle.checked = settings.showGreeting !== false;
        showGreetingToggle.addEventListener('change', (e) => {
            settings.showGreeting = e.target.checked;
            saveSettings();
            updateTime();
        });
    }

    if (bgBlurSlider) {
        bgBlurSlider.value = settings.bgBlur || 0;
        if (bgBlurVal) bgBlurVal.textContent = `${settings.bgBlur || 0}px`;
        bgBlurSlider.addEventListener('input', (e) => {
            settings.bgBlur = parseInt(e.target.value);
            if (bgBlurVal) bgBlurVal.textContent = `${settings.bgBlur}px`;
            applyWallpaperEffects();
            saveSettings();
        });
    }

    if (bgDimSlider) {
        bgDimSlider.value = settings.bgDim !== undefined ? settings.bgDim : 30;
        if (bgDimVal) bgDimVal.textContent = `${settings.bgDim}%`;
        bgDimSlider.addEventListener('input', (e) => {
            settings.bgDim = parseInt(e.target.value);
            if (bgDimVal) bgDimVal.textContent = `${settings.bgDim}%`;
            applyWallpaperEffects();
            saveSettings();
        });
    }

    if (bgUpload) {
        bgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showToast('Image too large. Max 5MB.', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                try {
                    localStorage.setItem('customBg', dataUrl);
                    applyWallpaperEffects();
                    showToast('Background updated!', 'success');
                } catch {
                    showToast('Failed to save image in storage.', 'error');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            localStorage.removeItem('customBg');
            applyWallpaperEffects();
            showToast('Background reset to default.', 'info');
            if (bgUpload) bgUpload.value = '';
        });
    }

    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) importData(file);
        });
    }

    const confirmCancel = document.getElementById('confirm-cancel-btn');
    const confirmYes = document.getElementById('confirm-yes-btn');

    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            closeModal('confirm-modal');
            if (confirmCallbackCancel) confirmCallbackCancel();
            cleanConfirmCallbacks();
        });
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            closeModal('confirm-modal');
            if (confirmCallbackYes) confirmCallbackYes();
            cleanConfirmCallbacks();
        });
    }

    applyWallpaperEffects();
}

function applySettingsToUI() {
    const is12HourToggle = document.getElementById('setting-12hour');
    const showDateToggle = document.getElementById('setting-show-date');
    const showGreetingToggle = document.getElementById('setting-show-greeting');
    const bgBlurSlider = document.getElementById('bg-blur-slider');
    const bgDimSlider = document.getElementById('bg-dim-slider');
    const bgBlurVal = document.getElementById('bg-blur-val');
    const bgDimVal = document.getElementById('bg-dim-val');

    if (is12HourToggle) is12HourToggle.checked = !!settings.is12Hour;
    if (showDateToggle) showDateToggle.checked = settings.showDate !== false;
    if (showGreetingToggle) showGreetingToggle.checked = settings.showGreeting !== false;

    if (bgBlurSlider) {
        bgBlurSlider.value = settings.bgBlur || 0;
        if (bgBlurVal) bgBlurVal.textContent = `${settings.bgBlur || 0}px`;
    }
    if (bgDimSlider) {
        bgDimSlider.value = settings.bgDim !== undefined ? settings.bgDim : 30;
        if (bgDimVal) bgDimVal.textContent = `${settings.bgDim}%`;
    }

    applyWallpaperEffects();
    updateTime();
}

function applyWallpaperEffects() {
    const overlay = document.querySelector('.background-overlay');
    if (!overlay) return;

    const savedBg = localStorage.getItem('customBg');
    if (savedBg) {
        overlay.style.backgroundImage = `url('${savedBg}')`;
        overlay.style.filter = `blur(${settings.bgBlur || 0}px)`;
        overlay.style.opacity = (1 - ((settings.bgDim || 30) / 100)).toString();
    } else {
        overlay.style.backgroundImage = '';
        overlay.style.filter = 'none';
        overlay.style.opacity = '1';
    }
}

// Event Listeners for CRUD & Modals
function setupEventListeners() {
    if (addSectionBtn) {
        addSectionBtn.addEventListener('click', () => {
            sectionModalTitle.textContent = 'New Section';
            sectionNameInput.value = '';
            sectionIdEdit.value = '';
            const randomIcon = getRandomIcon();
            selectIconInPicker(randomIcon);
            openModal('section-modal');
        });
    }

    if (saveSectionBtn) {
        saveSectionBtn.addEventListener('click', () => {
            const name = sectionNameInput.value.trim();
            const icon = sectionIconInput.value || getRandomIcon();
            const editIndex = sectionIdEdit.value;

            if (name) {
                if (editIndex !== '') {
                    sections[editIndex].name = name;
                    sections[editIndex].icon = icon;
                } else {
                    sections.push({
                        name: name,
                        icon: icon,
                        links: []
                    });
                }
                saveData();
                renderSections();
                closeModal('section-modal');
                showToast(editIndex !== '' ? 'Section updated.' : 'Section created.', 'success');
            }
        });
    }

    if (saveLinkBtn) {
        saveLinkBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('link-name');
            const urlInput = document.getElementById('link-url');
            const sectionIndex = document.getElementById('link-section-id').value;

            if (nameInput.value.trim() && urlInput.value.trim()) {
                let url = urlInput.value.trim();
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }

                if (isDuplicateUrl(url)) {
                    showToast('This URL is already pinned!', 'error');
                    return;
                }

                if (!sections[sectionIndex].links) sections[sectionIndex].links = [];
                sections[sectionIndex].links.push({
                    name: nameInput.value.trim(),
                    url: url
                });

                saveData();
                renderSections();
                closeModal('link-modal');
                nameInput.value = '';
                urlInput.value = '';
                showToast('Link added successfully.', 'success');
            }
        });
    }

    const saveTabPickerBtn = document.getElementById('save-tab-picker-btn');
    if (saveTabPickerBtn) {
        saveTabPickerBtn.addEventListener('click', () => {
            const existingIndex = document.getElementById('existing-section-select').value;
            const newName = document.getElementById('new-section-name').value.trim();
            const url = document.getElementById('tab-to-add-url').value;
            const title = document.getElementById('tab-to-add-title').value;

            if (isDuplicateUrl(url)) {
                showToast('This URL is already pinned!', 'error');
                return;
            }

            if (newName) {
                sections.push({
                    name: newName,
                    icon: getRandomIcon(),
                    links: [{ name: title, url: url }]
                });
                saveData();
                renderSections();
                closeModal('tab-picker-modal');
                showToast('Created section and pinned tab.', 'success');
            } else if (existingIndex !== '') {
                if (!sections[existingIndex].links) sections[existingIndex].links = [];
                sections[existingIndex].links.push({ name: title, url: url });
                saveData();
                renderSections();
                closeModal('tab-picker-modal');
                showToast('Tab pinned to section.', 'success');
            } else {
                showToast('Please select a section or create a new one.', 'error');
            }
        });
    }

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.closeModal;
            closeModal(modalId);
        });
    });

    document.getElementById('cancel-section-btn')?.addEventListener('click', () => closeModal('section-modal'));
    document.getElementById('cancel-link-btn')?.addEventListener('click', () => closeModal('link-modal'));
    document.getElementById('cancel-tab-picker-btn')?.addEventListener('click', () => closeModal('tab-picker-modal'));

    if (sectionsContainer) {
        sectionsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const index = btn.dataset.index;

            if (action === 'open-link-modal') {
                document.getElementById('link-section-id').value = index;
                openModal('link-modal');
                setTimeout(() => document.getElementById('link-name')?.focus(), 50);
            } else if (action === 'edit-section') {
                const section = sections[index];
                sectionModalTitle.textContent = 'Edit Section';
                sectionNameInput.value = section.name;
                sectionIdEdit.value = index;
                selectIconInPicker(section.icon);
                openModal('section-modal');
            } else if (action === 'delete-section') {
                deleteSection(index);
            } else if (action === 'delete-link') {
                const sIndex = btn.dataset.section;
                const lIndex = btn.dataset.link;
                deleteLink(sIndex, lIndex);
            }
        });
    }
}

// Backup Operations
function exportData() {
    const data = JSON.stringify({
        version: '1.4',
        exportDate: new Date().toISOString(),
        sections,
        settings,
        theme: currentTheme
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];

    const a = document.createElement('a');
    a.href = url;
    a.download = `zentab-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded.', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            const importedSections = Array.isArray(imported) ? imported : imported.sections;

            if (Array.isArray(importedSections)) {
                showConfirm('Importing will replace your current sections. Continue?', () => {
                    sections = importedSections.map(s => ({
                        ...s,
                        icon: s.icon || getRandomIcon()
                    }));
                    if (imported.settings) settings = { ...settings, ...imported.settings };
                    if (imported.theme) applyTheme(imported.theme, true);

                    saveData();
                    saveSettings();
                    applySettingsToUI();
                    renderSections();
                    showToast('Backup restored successfully!', 'success');
                });
            } else {
                showToast('Invalid backup file structure.', 'error');
            }
        } catch {
            showToast('Error parsing JSON backup file.', 'error');
        }
    };
    reader.readAsText(file);
}

// Delete Helpers
function deleteSection(index) {
    const name = sections[index] ? sections[index].name : 'this section';
    showConfirm(`Delete "${name}" and all its links?`, () => {
        sections.splice(index, 1);
        saveData();
        renderSections();
        showToast('Section deleted.', 'info');
    });
}

function deleteLink(sIndex, lIndex) {
    sections[sIndex].links.splice(lIndex, 1);
    saveData();
    renderSections();
    showToast('Link removed.', 'info');
}

// Modal Helpers
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
}

function showConfirm(message, onYes, onCancel) {
    const confirmMsg = document.getElementById('confirm-message');
    if (confirmMsg) confirmMsg.textContent = message;
    confirmCallbackYes = onYes;
    confirmCallbackCancel = onCancel;
    openModal('confirm-modal');
}

function cleanConfirmCallbacks() {
    confirmCallbackYes = null;
    confirmCallbackCancel = null;
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.25s forwards';
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) toast.remove();
        });
    }, 2800);
}

// Initialization Sequence
function init() {
    loadInitialCache();
    updateTime();
    setInterval(updateTime, 1000);
    loadData();
    setupEventListeners();
    renderIconPicker();
    initTheme();
    initSidebar();
    initSearch();
    initSettings();
}

// Run immediately
init();
