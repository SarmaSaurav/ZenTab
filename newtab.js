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
    bgDim: 30,
    cardsPerRow: 'auto',
    lastDarkTheme: 'dark'
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
const foldAllBtn = document.getElementById('fold-all-btn');
const foldAllLabel = document.getElementById('fold-all-label');

// Favicon Helper: Native Chrome cached favicon API where available,
// otherwise the remote icon service with a monogram fallback.
const NATIVE_FAVICON_SUPPORTED = (() => {
    try {
        if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getManifest !== 'function') {
            return false;
        }
        const permissions = chrome.runtime.getManifest().permissions;
        return Array.isArray(permissions) && permissions.includes('favicon');
    } catch {
        return false;
    }
})();

function getFaviconUrl(url, size = 32) {
    if (NATIVE_FAVICON_SUPPORTED && chrome.runtime && chrome.runtime.getURL) {
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

// ---------------------------------------------------------------------------
// Storage layer
// ---------------------------------------------------------------------------
// Sections are split into chunks so a single storage item never exceeds the
// 8 KB chrome.storage.sync per-item quota. If sync fails (quota, signed-out,
// etc.) we fall back to chrome.storage.local instead of silently losing data.
const SYNC_META_KEY = 'zt_sections_meta';
const SYNC_CHUNK_PREFIX = 'zt_sections_chunk_';
const SYNC_CHUNK_BYTES = 7000;
const SCHEMA_VERSION = 2;
const SYNC_DEBOUNCE_MS = 400;

const syncStatus = {
    failed: false,
    warned: false,
    timer: null,
    remoteTimer: null,
    chunks: 0,
    lastSectionsJson: '',
    lastPrefsJson: '',
    removeLegacy: false
};

function hasChromeStorage(area) {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage[area];
}

function chunkStringByBytes(str, maxBytes) {
    const encoder = new TextEncoder();
    const chunks = [];
    let start = 0;

    while (start < str.length) {
        let end = str.length;

        if (encoder.encode(str.slice(start)).length > maxBytes) {
            let low = 1;
            let high = str.length - start;

            while (low < high) {
                const mid = Math.ceil((low + high) / 2);
                if (encoder.encode(str.slice(start, start + mid)).length <= maxBytes) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            }

            end = start + low;
            // Never split a surrogate pair across two storage items.
            if (end < str.length && /[\uD800-\uDBFF]/.test(str[end - 1])) end += 1;
        }

        chunks.push(str.slice(start, end));
        start = end;
    }

    return chunks.length ? chunks : [''];
}

function getStoredSections(result) {
    const meta = result[SYNC_META_KEY];
    let raw = null;
    let chunkCount = 0;
    let fromLegacy = false;

    if (meta && meta.version === SCHEMA_VERSION && Number.isInteger(meta.chunks)) {
        let json = '';
        for (let i = 0; i < meta.chunks; i++) {
            const chunk = result[SYNC_CHUNK_PREFIX + i];
            if (typeof chunk !== 'string') {
                json = '';
                break;
            }
            json += chunk;
        }

        if (json) {
            try {
                raw = JSON.parse(json);
                chunkCount = meta.chunks;
            } catch (e) {
                console.warn('ZenTab: could not parse stored sections.', e);
            }
        }
    }

    const hasLegacyValue = Array.isArray(result.sections);
    if (!raw && hasLegacyValue) {
        raw = result.sections;
        fromLegacy = true;
    }

    return {
        sections: Array.isArray(raw)
            ? raw
                .filter(s => s && typeof s === 'object')
                .map(s => ({ ...s, icon: s.icon || getRandomIcon() }))
            : null,
        chunkCount,
        legacy: fromLegacy,
        updated: meta && Number.isFinite(meta.updated) ? meta.updated : 0,
        theme: typeof result.theme === 'string' ? result.theme : null,
        settings: result.settings && typeof result.settings === 'object' ? result.settings : null
    };
}

function applyLoadedState(state) {
    let changed = false;

    if (state.sections) {
        const nextJson = JSON.stringify(state.sections);
        if (nextJson !== JSON.stringify(sections)) {
            sections = state.sections;
            try {
                localStorage.setItem('zenTabSections', nextJson);
            } catch (e) {
                console.warn('LocalStorage save failed:', e);
            }
            changed = true;
        }
        syncStatus.lastSectionsJson = nextJson;
    }

    if (state.theme && state.theme !== currentTheme) {
        applyTheme(state.theme, false);
        changed = true;
    }

    if (state.settings) {
        const merged = { ...settings, ...state.settings };
        if (JSON.stringify(merged) !== JSON.stringify(settings)) {
            settings = merged;
            applySettingsToUI();
            changed = true;
        }
    }

    if (state.chunkCount) syncStatus.chunks = state.chunkCount;
    syncStatus.lastPrefsJson = JSON.stringify({ theme: currentTheme, settings });

    if (changed) renderSections();
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
    if (!hasChromeStorage('sync')) {
        if (!sections || sections.length === 0) {
            const saved = localStorage.getItem('zenTabSections');
            sections = saved ? JSON.parse(saved) : getDefaultSections();
            saveData();
            renderSections();
        }
        return;
    }

    chrome.storage.sync.get(null, (result) => {
        if (chrome.runtime.lastError) {
            loadFromArea('local');
            return;
        }

        const state = getStoredSections(result);
        if (!state.sections) {
            loadFromArea('local');
            return;
        }

        // Clean up the pre-1.5 single-item key once valid v2 data exists.
        if (!state.legacy && Object.prototype.hasOwnProperty.call(result, 'sections')) {
            chrome.storage.sync.remove('sections', () => { void chrome.runtime.lastError; });
        }

        // The local fallback may be newer than sync (e.g. after a quota
        // failure), so prefer it when its timestamp is more recent.
        if (hasChromeStorage('local')) {
            chrome.storage.local.get(SYNC_META_KEY, (localResult) => {
                const localMeta = !chrome.runtime.lastError && localResult
                    ? localResult[SYNC_META_KEY]
                    : null;

                if (localMeta && Number.isFinite(localMeta.updated) && localMeta.updated > state.updated) {
                    loadFromArea('local');
                    return;
                }

                finishSyncLoad(state);
            });
            return;
        }

        finishSyncLoad(state);
    });
}

function finishSyncLoad(state) {
    applyLoadedState(state);
    if (state.legacy) {
        // Migrate the legacy single-item layout to chunked v2 keys.
        syncStatus.lastSectionsJson = '';
        syncStatus.removeLegacy = true;
        queueSyncSave();
    }
}

function loadFromArea(area) {
    if (!hasChromeStorage(area)) {
        seedDefaultSections();
        return;
    }

    chrome.storage[area].get(null, (result) => {
        if (chrome.runtime.lastError) {
            seedDefaultSections();
            return;
        }

        const state = getStoredSections(result);
        if (state.sections) {
            applyLoadedState(state);
            if (area !== 'sync' && !syncStatus.failed) {
                // Data only exists in the local fallback; try to restore sync.
                syncStatus.lastSectionsJson = '';
                queueSyncSave();
            }
            return;
        }

        seedDefaultSections();
    });
}

function seedDefaultSections() {
    if (sections.length === 0) {
        sections = getDefaultSections();
        renderSections();
    }
    syncStatus.lastSectionsJson = '';
    queueSyncSave();
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
    const json = JSON.stringify(sections);
    try {
        localStorage.setItem('zenTabSections', json);
    } catch (e) {
        console.warn('LocalStorage save failed:', e);
    }

    queueSyncSave();
}

function saveSettings() {
    try {
        localStorage.setItem('zenTabSettings', JSON.stringify(settings));
    } catch (e) {
        console.warn('LocalStorage settings save failed:', e);
    }

    queueSyncSave();
}

function queueSyncSave() {
    if (syncStatus.timer) clearTimeout(syncStatus.timer);
    syncStatus.timer = setTimeout(() => {
        syncStatus.timer = null;
        flushSyncSave();
    }, SYNC_DEBOUNCE_MS);
}

function notifySyncFailure() {
    if (syncStatus.warned) return;
    syncStatus.warned = true;
    showToast('Could not sync to your browser account. Changes are saved on this device.', 'error');
}

function writeToArea(area, payload, done) {
    try {
        chrome.storage[area].set(payload, () => {
            done(chrome.runtime.lastError || null);
        });
    } catch (e) {
        done(e);
    }
}

function commitSyncWrite(area, sectionsJson, prefsJson, chunkCount) {
    syncStatus.lastSectionsJson = sectionsJson;
    syncStatus.lastPrefsJson = prefsJson;

    if (chunkCount !== null) {
        const staleKeys = [];
        for (let i = chunkCount; i < syncStatus.chunks; i++) {
            staleKeys.push(SYNC_CHUNK_PREFIX + i);
        }
        syncStatus.chunks = chunkCount;
        if (staleKeys.length && hasChromeStorage(area)) {
            chrome.storage[area].remove(staleKeys, () => { void chrome.runtime.lastError; });
        }
    }

    if (syncStatus.removeLegacy && hasChromeStorage('sync')) {
        chrome.storage.sync.remove('sections', () => { void chrome.runtime.lastError; });
        syncStatus.removeLegacy = false;
    }
}

function finishSyncWrite(area, sectionsJson, prefsJson, chunkCount) {
    commitSyncWrite(area, sectionsJson, prefsJson, chunkCount);

    // Edits made while the write was in flight still need persisting.
    const currentSectionsJson = JSON.stringify(sections);
    const currentPrefsJson = JSON.stringify({ theme: currentTheme, settings });
    if (currentSectionsJson !== sectionsJson || currentPrefsJson !== prefsJson) {
        queueSyncSave();
    }
}

function flushSyncSave() {
    if (!hasChromeStorage('sync') && !hasChromeStorage('local')) return;

    const sectionsJson = JSON.stringify(sections);
    const prefsJson = JSON.stringify({ theme: currentTheme, settings });
    const payload = {};
    let chunkCount = null;

    if (sectionsJson !== syncStatus.lastSectionsJson) {
        const chunks = chunkStringByBytes(sectionsJson, SYNC_CHUNK_BYTES);
        chunks.forEach((chunk, i) => {
            payload[SYNC_CHUNK_PREFIX + i] = chunk;
        });
        payload[SYNC_META_KEY] = {
            version: SCHEMA_VERSION,
            chunks: chunks.length,
            updated: Date.now()
        };
        chunkCount = chunks.length;
    }

    if (prefsJson !== syncStatus.lastPrefsJson) {
        payload.theme = currentTheme;
        payload.settings = settings;
    }

    if (Object.keys(payload).length === 0) return;

    if (!syncStatus.failed && hasChromeStorage('sync')) {
        writeToArea('sync', payload, (err) => {
            if (!err) {
                finishSyncWrite('sync', sectionsJson, prefsJson, chunkCount);
                return;
            }

            console.warn('ZenTab: sync write failed, falling back to local storage.', err);
            syncStatus.failed = true;
            writeToArea('local', payload, (localErr) => {
                if (!localErr) finishSyncWrite('local', sectionsJson, prefsJson, chunkCount);
                notifySyncFailure();
            });
        });
        return;
    }

    if (hasChromeStorage('local')) {
        writeToArea('local', payload, (err) => {
            if (!err) {
                finishSyncWrite('local', sectionsJson, prefsJson, chunkCount);
            } else {
                notifySyncFailure();
            }
        });
    }
}

function applyRemoteArea(area) {
    if (!hasChromeStorage(area)) return;

    chrome.storage[area].get(null, (result) => {
        if (chrome.runtime.lastError) return;
        applyLoadedState(getStoredSections(result));
    });
}

function initStorageListener() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' && area !== 'local') return;
        if (area === 'local' && !syncStatus.failed) return;

        // Do not let an incoming change overwrite local edits that have not
        // been written yet. Last write wins once our save completes.
        if (syncStatus.timer) return;

        const relevant = Object.keys(changes).some(key =>
            key === SYNC_META_KEY ||
            key.startsWith(SYNC_CHUNK_PREFIX) ||
            key === 'sections' ||
            key === 'theme' ||
            key === 'settings'
        );
        if (!relevant) return;

        if (syncStatus.remoteTimer) clearTimeout(syncStatus.remoteTimer);
        syncStatus.remoteTimer = setTimeout(() => {
            syncStatus.remoteTimer = null;
            applyRemoteArea(area);
        }, 200);
    });
}

// High-Performance DocumentFragment Rendering
function renderSections() {
    if (!sectionsContainer) return;

    const fragment = document.createDocumentFragment();

    sections.forEach((section, index) => {
        const isCollapsed = !!section.collapsed;
        const sectionEl = document.createElement('div');
        sectionEl.className = isCollapsed ? 'section-card collapsed' : 'section-card';
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
                            <img src="${escapeHtml(faviconUrl)}" class="link-favicon" alt="" loading="lazy">
                            <div class="favicon-monogram" style="${monogram.style} display: none;">${escapeHtml(monogram.initial)}</div>
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
                    <button class="section-collapse-btn" type="button" data-action="toggle-section" data-index="${index}"
                        aria-expanded="${!isCollapsed}"
                        aria-label="${isCollapsed ? 'Expand' : 'Collapse'} ${escapeHtml(section.name)}"
                        title="${isCollapsed ? 'Expand' : 'Collapse'} ${escapeHtml(section.name)}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <span class="section-icon">${escapeHtml(section.icon || '📁')}</span>
                    <h2 class="section-title" title="${escapeHtml(section.name)}">${escapeHtml(section.name)}</h2>
                </div>
                <div class="section-header-end">
                    <span class="section-link-count" title="${(section.links || []).length} ${(section.links || []).length === 1 ? 'link' : 'links'}">${(section.links || []).length}</span>
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
            </div>
            <div class="section-body">
                <div class="section-body-inner">
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
                </div>
            </div>
        `;

        fragment.appendChild(sectionEl);
    });

    sectionsContainer.innerHTML = '';
    sectionsContainer.appendChild(fragment);

    setupDragAndDrop();
    updateFoldAllButton();
}

function setSectionCollapsed(index, collapsed, persist = true) {
    const section = sections[index];
    if (!section) return;

    section.collapsed = collapsed;

    const card = sectionsContainer
        ? sectionsContainer.querySelector(`.section-card[data-index="${index}"]`)
        : null;

    if (card) {
        card.classList.toggle('collapsed', collapsed);
        const toggle = card.querySelector('.section-collapse-btn');
        if (toggle) {
            const label = `${collapsed ? 'Expand' : 'Collapse'} ${section.name || 'section'}`;
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.setAttribute('aria-label', label);
            toggle.title = label;
        }
    }

    if (persist) {
        saveData();
        updateFoldAllButton();
    }
}

function toggleSectionCollapsed(index) {
    const section = sections[index];
    if (!section) return;
    setSectionCollapsed(index, !section.collapsed);
}

function updateFoldAllButton() {
    if (!foldAllBtn) return;

    const allCollapsed = sections.length > 0 && sections.every(s => s.collapsed);
    const label = allCollapsed ? 'Unfold all sections' : 'Fold all sections';

    foldAllBtn.setAttribute('aria-pressed', String(allCollapsed));
    foldAllBtn.setAttribute('aria-label', label);
    foldAllBtn.title = label;
    if (foldAllLabel) foldAllLabel.textContent = allCollapsed ? 'Unfold' : 'Fold';
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
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
        clearSearchExpansion();
        document.querySelectorAll('.section-card').forEach(s => s.style.display = '');
        document.querySelectorAll('.link-item-wrapper').forEach(l => l.style.display = '');
        return;
    }

    const isSearching = query.length > 0;
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

        // Keep collapsed sections closed, but reveal matches while searching.
        if (isSearching && hasLinkMatch) {
            section.classList.add('force-expanded');
        } else {
            section.classList.remove('force-expanded');
        }
    });
}

function clearSearchExpansion() {
    document.querySelectorAll('.section-card.force-expanded').forEach(section => {
        section.classList.remove('force-expanded');
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
            // Toggle between light and the last dark preset the user picked.
            const fallbackDark = settings.lastDarkTheme && settings.lastDarkTheme !== 'light'
                ? settings.lastDarkTheme
                : 'dark';
            const nextTheme = currentTheme === 'light' ? fallbackDark : 'light';
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

    if (theme !== 'light') {
        settings.lastDarkTheme = theme;
    }

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

    if (quickThemeToggle) {
        const isLight = theme === 'light';
        const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
        quickThemeToggle.setAttribute('aria-label', label);
        quickThemeToggle.setAttribute('aria-pressed', String(isLight));
        quickThemeToggle.title = label;
    }

    if (save) {
        localStorage.setItem('zenTabTheme', theme);
        // Also persists lastDarkTheme, so the quick toggle can restore it.
        saveSettings();
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
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('brave://') &&
            !tab.url.startsWith('moz-extension://') &&
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
const CARD_COLUMN_OPTIONS = ['auto', '2', '3', '4', '5'];

function normalizeCardsPerRow(value) {
    const normalized = String(value);
    return CARD_COLUMN_OPTIONS.includes(normalized) ? normalized : 'auto';
}

function applyGridColumns() {
    if (!sectionsContainer) return;

    const columns = normalizeCardsPerRow(settings.cardsPerRow);
    if (columns === 'auto') {
        sectionsContainer.removeAttribute('data-columns');
    } else {
        sectionsContainer.setAttribute('data-columns', columns);
    }
}

function initSettings() {
    const settingsBtn = document.getElementById('settings-toggle');
    const closeSettings = document.getElementById('close-settings-btn');
    const is12HourToggle = document.getElementById('setting-12hour');
    const showDateToggle = document.getElementById('setting-show-date');
    const showGreetingToggle = document.getElementById('setting-show-greeting');
    const cardsPerRowSelect = document.getElementById('setting-cards-per-row');

    const bgUpload = document.getElementById('bg-upload');
    const resetBgBtn = document.getElementById('reset-bg-btn');
    const bgBlurSlider = document.getElementById('bg-blur-slider');
    const bgDimSlider = document.getElementById('bg-dim-slider');
    const bgBlurVal = document.getElementById('bg-blur-val');
    const bgDimVal = document.getElementById('bg-dim-val');

    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    if (closeSettings) closeSettings.addEventListener('click', () => closeModal('settings-modal'));

    if (cardsPerRowSelect) {
        cardsPerRowSelect.value = normalizeCardsPerRow(settings.cardsPerRow);
        cardsPerRowSelect.addEventListener('change', (e) => {
            settings.cardsPerRow = normalizeCardsPerRow(e.target.value);
            applyGridColumns();
            saveSettings();
        });
    }

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
            // Allow importing the same file again later.
            e.target.value = '';
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
    applyGridColumns();
}

function applySettingsToUI() {
    const is12HourToggle = document.getElementById('setting-12hour');
    const showDateToggle = document.getElementById('setting-show-date');
    const showGreetingToggle = document.getElementById('setting-show-greeting');
    const cardsPerRowSelect = document.getElementById('setting-cards-per-row');
    const bgBlurSlider = document.getElementById('bg-blur-slider');
    const bgDimSlider = document.getElementById('bg-dim-slider');
    const bgBlurVal = document.getElementById('bg-blur-val');
    const bgDimVal = document.getElementById('bg-dim-val');

    if (is12HourToggle) is12HourToggle.checked = !!settings.is12Hour;
    if (showDateToggle) showDateToggle.checked = settings.showDate !== false;
    if (showGreetingToggle) showGreetingToggle.checked = settings.showGreeting !== false;
    if (cardsPerRowSelect) cardsPerRowSelect.value = normalizeCardsPerRow(settings.cardsPerRow);

    if (bgBlurSlider) {
        bgBlurSlider.value = settings.bgBlur || 0;
        if (bgBlurVal) bgBlurVal.textContent = `${settings.bgBlur || 0}px`;
    }
    if (bgDimSlider) {
        bgDimSlider.value = settings.bgDim !== undefined ? settings.bgDim : 30;
        if (bgDimVal) bgDimVal.textContent = `${settings.bgDim}%`;
    }

    applyWallpaperEffects();
    applyGridColumns();
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

// Hover preview for link cards
function initLinkPreview() {
    const preview = document.getElementById('link-preview');
    if (!preview || !sectionsContainer) return;

    const domainEl = preview.querySelector('.link-preview-domain');
    const nameEl = preview.querySelector('.link-preview-name');
    const urlEl = preview.querySelector('.link-preview-url');
    const iconEl = preview.querySelector('.link-preview-favicon');
    const monogramEl = preview.querySelector('.link-preview-monogram');

    let showTimer = null;
    let hideTimer = null;
    let activeLink = null;

    const hide = () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        activeLink = null;
        preview.classList.remove('visible');
    };

    const show = (link) => {
        const wrapper = link.closest('.link-item-wrapper');
        if (!wrapper) return;

        const section = sections[Number(wrapper.dataset.section)];
        const item = section && section.links && section.links[Number(wrapper.dataset.link)];
        if (!item) return;

        let hostname = item.url;
        try {
            hostname = new URL(item.url).hostname.replace(/^www\./, '');
        } catch {
            // Keep the raw URL as a fallback.
        }

        const monogram = getMonogram(item.name, item.url);

        domainEl.textContent = hostname;
        nameEl.textContent = item.name;
        urlEl.textContent = item.url;

        iconEl.style.display = '';
        iconEl.removeAttribute('src');
        iconEl.src = getFaviconUrl(item.url, 64);

        monogramEl.textContent = monogram.initial;
        monogramEl.style.cssText = `${monogram.style} display: none;`;

        activeLink = link;
        preview.classList.add('visible');

        const rect = link.getBoundingClientRect();
        const previewWidth = preview.offsetWidth;
        const previewHeight = preview.offsetHeight;
        const gap = 12;
        let left = rect.right + gap;
        let origin = 'left center';

        if (left + previewWidth > window.innerWidth - 12) {
            left = rect.left - previewWidth - gap;
            origin = 'right center';
        }

        if (left < 12) {
            left = Math.min(Math.max(12, rect.left), window.innerWidth - previewWidth - 12);
            origin = 'center center';
        }

        let top = rect.top + (rect.height - previewHeight) / 2;
        top = Math.max(12, Math.min(top, window.innerHeight - previewHeight - 12));

        preview.style.transformOrigin = origin;
        preview.style.left = `${Math.round(left)}px`;
        preview.style.top = `${Math.round(top)}px`;
    };

    const scheduleShow = (link) => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        showTimer = setTimeout(() => show(link), 140);
    };

    const scheduleHide = () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 240);
    };

    preview.addEventListener('error', (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.classList.contains('link-preview-favicon')) return;

        img.style.display = 'none';
        monogramEl.style.display = 'flex';
    }, true);

    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        sectionsContainer.addEventListener('mouseover', (e) => {
            const link = e.target.closest('.link-item');
            if (!link || link === activeLink) return;

            scheduleShow(link);
        });

        sectionsContainer.addEventListener('mouseout', (e) => {
            const link = e.target.closest('.link-item');
            if (!link) return;

            if (e.relatedTarget && link.contains(e.relatedTarget)) return;

            scheduleHide();
        });
    }

    sectionsContainer.addEventListener('focusin', (e) => {
        const link = e.target.closest('.link-item');
        if (link && link.matches(':focus-visible')) show(link);
    });

    sectionsContainer.addEventListener('focusout', (e) => {
        if (e.target.closest('.link-item')) scheduleHide();
    });

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
}

// Event Listeners for CRUD & Modals
function setupEventListeners() {
    if (foldAllBtn) {
        foldAllBtn.addEventListener('click', () => {
            if (sections.length === 0) return;

            const shouldCollapse = !sections.every(s => s.collapsed);
            sections.forEach((_, i) => setSectionCollapsed(i, shouldCollapse, false));
            saveData();
            updateFoldAllButton();
        });
    }

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
        // Inline onerror handlers are blocked by the MV3 CSP, so the favicon
        // fallback is handled here instead (error events do not bubble).
        sectionsContainer.addEventListener('error', (e) => {
            const img = e.target;
            if (!(img instanceof HTMLImageElement) || !img.classList.contains('link-favicon')) return;

            img.style.display = 'none';
            const monogram = img.nextElementSibling;
            if (monogram && monogram.classList.contains('favicon-monogram')) {
                monogram.style.display = 'flex';
            }
        }, true);
        sectionsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) {
                // Clicking anywhere in the header (except its action buttons)
                // folds/unfolds the section.
                const header = e.target.closest('.section-header');
                if (header && !e.target.closest('.header-actions')) {
                    const card = header.closest('.section-card');
                    if (card) toggleSectionCollapsed(card.dataset.index);
                }
                return;
            }

            const action = btn.dataset.action;
            const index = btn.dataset.index;

            if (action === 'open-link-modal') {
                document.getElementById('link-section-id').value = index;
                openModal('link-modal');
                setTimeout(() => document.getElementById('link-name')?.focus(), 50);
            } else if (action === 'toggle-section') {
                toggleSectionCollapsed(index);
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

    initLinkPreview();
}

// Backup Operations
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_SECTIONS = 200;
const MAX_IMPORT_LINKS = 2000;
const MAX_LINKS_PER_SECTION = 500;
const ALLOWED_THEMES = ['dark', 'oled', 'cyber', 'sunset', 'nordic', 'dracula', 'light'];

function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeUrl(raw) {
    let value = String(raw ?? '').trim();
    if (!value) return null;

    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        value = 'https://' + value;
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return null;
    }

    // Only allow web links; block javascript:, data:, file:, etc.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
}

function normalizeImportedSections(rawSections) {
    const input = Array.isArray(rawSections) ? rawSections : [];
    const result = [];
    const seen = new Set();
    let skipped = 0;
    let totalLinks = 0;

    for (const rawSection of input.slice(0, MAX_IMPORT_SECTIONS)) {
        if (!rawSection || typeof rawSection !== 'object') {
            skipped++;
            continue;
        }

        const links = [];
        const rawLinks = Array.isArray(rawSection.links)
            ? rawSection.links.slice(0, MAX_LINKS_PER_SECTION)
            : [];

        for (const rawLink of rawLinks) {
            if (totalLinks >= MAX_IMPORT_LINKS) break;

            if (!rawLink || typeof rawLink !== 'object') {
                skipped++;
                continue;
            }

            const url = normalizeUrl(rawLink.url);
            if (!url) {
                skipped++;
                continue;
            }

            const dedupeKey = url.replace(/\/+$/, '').toLowerCase();
            if (seen.has(dedupeKey)) {
                skipped++;
                continue;
            }
            seen.add(dedupeKey);

            let fallbackName = url;
            try {
                fallbackName = new URL(url).hostname.replace(/^www\./, '');
            } catch {
                // Keep the URL as the fallback name.
            }

            const name = String(rawLink.name ?? '').trim().slice(0, 200) || fallbackName;
            links.push({ name, url });
            totalLinks++;
        }

        const name = String(rawSection.name ?? '').trim().slice(0, 120) || 'Untitled Section';
        const icon = typeof rawSection.icon === 'string' && rawSection.icon.trim()
            ? rawSection.icon.trim().slice(0, 8)
            : getRandomIcon();

        const section = { name, icon, links };
        if (rawSection.collapsed === true) section.collapsed = true;
        result.push(section);
    }

    return { sections: result, skipped, totalLinks };
}

function normalizeImportedSettings(rawSettings) {
    if (!rawSettings || typeof rawSettings !== 'object') return null;

    return {
        is12Hour: !!rawSettings.is12Hour,
        showDate: rawSettings.showDate !== false,
        showGreeting: rawSettings.showGreeting !== false,
        bgBlur: clampNumber(rawSettings.bgBlur, 0, 25, 0),
        bgDim: clampNumber(rawSettings.bgDim, 0, 90, 30),
        cardsPerRow: normalizeCardsPerRow(rawSettings.cardsPerRow),
        lastDarkTheme: (rawSettings.lastDarkTheme !== 'light' && ALLOWED_THEMES.includes(rawSettings.lastDarkTheme))
            ? rawSettings.lastDarkTheme
            : 'dark'
    };
}

function exportData() {
    const version = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
        ? chrome.runtime.getManifest().version
        : '1.8';

    const data = JSON.stringify({
        version,
        schemaVersion: SCHEMA_VERSION,
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
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
        showToast('Backup is too large (max 2 MB).', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        let imported;
        try {
            imported = JSON.parse(e.target.result);
        } catch {
            showToast('Error parsing JSON backup file.', 'error');
            return;
        }

        const rawSections = Array.isArray(imported)
            ? imported
            : (imported && imported.sections);

        if (!Array.isArray(rawSections)) {
            showToast('Invalid backup file structure.', 'error');
            return;
        }

        const normalized = normalizeImportedSections(rawSections);
        if (normalized.sections.length === 0) {
            showToast('No valid sections or links found in this backup.', 'error');
            return;
        }

        const summary = `${normalized.sections.length} section(s)` +
            (normalized.totalLinks ? ` and ${normalized.totalLinks} link(s)` : '') +
            (normalized.skipped
                ? ` (${normalized.skipped} invalid ${normalized.skipped === 1 ? 'entry' : 'entries'} will be skipped)`
                : '');

        showConfirm(`Import ${summary}? This will replace your current sections.`, () => {
            sections = normalized.sections;

            const importedSettings = normalizeImportedSettings(imported && imported.settings);
            if (importedSettings) settings = importedSettings;

            if (imported && ALLOWED_THEMES.includes(imported.theme)) {
                applyTheme(imported.theme, true);
            }

            saveData();
            saveSettings();
            applySettingsToUI();
            renderSections();
            showToast(
                normalized.skipped
                    ? `Backup restored, ${normalized.skipped} invalid entries skipped.`
                    : 'Backup restored successfully!',
                normalized.skipped ? 'info' : 'success'
            );
        });
    };
    reader.onerror = () => showToast('Could not read the backup file.', 'error');
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
    initStorageListener();
    loadData();
    setupEventListeners();
    renderIconPicker();
    initTheme();
    initSidebar();
    initSearch();
    initSettings();

    // Flush debounced writes before the new tab page is discarded.
    window.addEventListener('pagehide', () => {
        if (!syncStatus.timer) return;
        clearTimeout(syncStatus.timer);
        syncStatus.timer = null;
        flushSyncSave();
    });
}

// Run immediately
init();
