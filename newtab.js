// Icons dictionary
const ICONS = [
    '📁', '🔗', '⭐', '🛠️', '📝', '🎨', '🚀', '🧠', '💼', '🏠',
    '📺', '🎮', '🎵', '📸', '🛒', '🍔', '✈️', '🌍', '❤️', '💡',
    '🔍', '📱', '💻', '🔋', '📫', '🏪', '🛖'
];

function getRandomIcon() {
    return ICONS[Math.floor(Math.random() * ICONS.length)];
}

// State management
let sections = [];
let dragSrcEl = null; // Drag and Drop State

function isDuplicateUrl(url) {
    const normalize = (u) => u.replace(/\/$/, '').toLowerCase();
    const normalizedUrl = normalize(url);

    return sections.some(section =>
        section.links.some(link => normalize(link.url) === normalizedUrl)
    );
}

// DOM Elements
const clockElement = document.getElementById('clock');
const greetingElement = document.getElementById('greeting');
const sectionsContainer = document.getElementById('sections-container');
const addSectionBtn = document.getElementById('add-section-btn');
const saveSectionBtn = document.getElementById('save-section-btn');
const saveLinkBtn = document.getElementById('save-link-btn');
const themeCheckbox = document.getElementById('theme-checkbox');

const sectionModalTitle = document.getElementById('section-modal-title');
const sectionNameInput = document.getElementById('section-name');
const sectionIconInput = document.getElementById('section-icon');
const sectionIdEdit = document.getElementById('section-id-edit');
const iconPicker = document.getElementById('icon-picker');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const tabsList = document.getElementById('tabs-list');
const refreshTabsBtn = document.getElementById('refresh-tabs');

// Settings & Utilities Constants

let confirmCallbackYes = null;
let confirmCallbackCancel = null;

// Search & Filter Logic
function initSearch() {
    const searchInput = document.getElementById('search-input');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterContent(query);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // If it looks like a URL, navigate there
                if (query.match(/^(http|https):\/\/[^ "]+$/) || query.match(/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
                    let url = query;
                    if (!url.startsWith('http')) url = 'https://' + url;
                    window.location.href = url;
                } else {
                    // Otherwise search Google
                    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                }
            }
        }
    });
}

function filterContent(query) {
    const sections = document.querySelectorAll('.section-card');
    let hasResults = false;

    sections.forEach(section => {
        const sectionTitle = section.querySelector('.section-title').textContent.toLowerCase();
        const links = section.querySelectorAll('.link-item-wrapper');
        let sectionHasMatch = false;

        // Check if section title matches
        if (sectionTitle.includes(query)) {
            sectionHasMatch = true;
            links.forEach(link => link.style.display = 'block');
        } else {
            // Check individual links
            links.forEach(link => {
                const linkName = link.querySelector('.link-name').textContent.toLowerCase();
                const linkUrl = link.querySelector('.link-url').textContent.toLowerCase();

                if (linkName.includes(query) || linkUrl.includes(query)) {
                    link.style.display = 'block';
                    sectionHasMatch = true;
                } else {
                    link.style.display = 'none';
                }
            });
        }

        if (sectionHasMatch) {
            section.style.display = 'block';
            hasResults = true;
        } else {
            section.style.display = 'none';
        }
    });
}

// Initialize
function init() {
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

// Theme Logic
function initTheme() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['theme'], (result) => {
            applyTheme(result.theme || 'dark');
        });
    } else {
        const savedTheme = localStorage.getItem('zenTabTheme') || 'dark';
        applyTheme(savedTheme);
    }

    themeCheckbox.addEventListener('change', () => {
        const newTheme = themeCheckbox.checked ? 'light' : 'dark';
        applyTheme(newTheme);
        saveTheme(newTheme);
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeCheckbox.checked = theme === 'light';
}

function saveTheme(theme) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.set({ theme });
    } else {
        localStorage.setItem('zenTabTheme', theme);
    }
}

// Sidebar & Tabs Logic
function initSidebar() {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarToggle.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            fetchOpenTabs();
        }
    });

    refreshTabsBtn.addEventListener('click', fetchOpenTabs);
}

async function fetchOpenTabs() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({}, (tabs) => {
            renderTabs(tabs);
        });
    } else {
        // Mock data
        const mockTabs = [
            { title: 'Google', url: 'https://google.com' },
            { title: 'GitHub', url: 'https://github.com' },
            { title: 'ZenTab Dashboard', url: 'chrome://newtab' }
        ];
        renderTabs(mockTabs);
    }
}

function renderTabs(tabs) {
    tabsList.innerHTML = '';
    const filteredTabs = tabs.filter(tab => {
        if (!tab || !tab.url) return false;
        return !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('edge://') &&
            !tab.url.startsWith('brave://') &&
            !tab.url.startsWith('about:');
    });

    if (filteredTabs.length === 0) {
        tabsList.innerHTML = '<p style="text-align:center; opacity:0.5; margin-top:20px;">No external tabs open</p>';
        return;
    }

    filteredTabs.forEach((tab, index) => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab-item';
        tabEl.innerHTML = `
            <div class="tab-info">
                <span class="tab-title" title="${tab.title}">${tab.title}</span>
                <span class="tab-url">${new URL(tab.url).hostname}</span>
            </div>
            <div class="tab-actions">
                <button class="btn-add-tab" data-url="${tab.url}" data-title="${tab.title}">+ Add to Section</button>
            </div>
        `;
        tabsList.appendChild(tabEl);
    });

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

function updateTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}`;

    const hour = now.getHours();
    if (hour < 12) greetingElement.textContent = 'Good morning';
    else if (hour < 18) greetingElement.textContent = 'Good afternoon';
    else greetingElement.textContent = 'Good evening';
}

// Storage Logic
function loadData() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['sections'], (result) => {
            sections = (result.sections || []).map(s => ({
                ...s,
                icon: s.icon || getRandomIcon()
            }));
            renderSections();
        });
    } else {
        const saved = localStorage.getItem('zenTabSections');
        sections = saved ? JSON.parse(saved) : [];
        let migrated = false;
        sections = sections.map(s => {
            if (!s.icon) {
                s.icon = getRandomIcon();
                migrated = true;
            }
            return s;
        });
        if (migrated) saveData();
        renderSections();
    }
}

function saveData() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.set({ sections });
    } else {
        localStorage.setItem('zenTabSections', JSON.stringify(sections));
    }
}

// Rendering Sections (with Drag and Drop & Favicons)
function renderSections() {
    sectionsContainer.innerHTML = '';

    sections.forEach((section, index) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-card';
        sectionEl.setAttribute('draggable', 'true');
        sectionEl.dataset.type = 'section';
        sectionEl.dataset.index = index;

        sectionEl.innerHTML = `
            <div class="section-header">
                <div class="section-title-container">
                    <span class="section-icon">${section.icon || '📁'}</span>
                    <h2 class="section-title">${section.name}</h2>
                </div>
                <div class="header-actions">
                    <span class="edit-btn" data-action="edit-section" data-index="${index}">✎</span>
                    <span class="delete-btn" data-action="delete-section" data-index="${index}">✕</span>
                </div>
            </div>
            <div class="links-list" data-section-index="${index}">
                ${section.links.map((link, linkIndex) => {
            const hostname = new URL(link.url).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

            return `
                    <div class="link-item-wrapper" style="position: relative;" draggable="true" data-type="link" data-section="${index}" data-link="${linkIndex}">
                        <a href="${link.url}" class="link-item">
                            <img src="${faviconUrl}" class="link-favicon" alt="" onerror="this.style.display='none'">
                            <div class="link-info">
                                <span class="link-name">${link.name}</span>
                                <span class="link-url">${hostname}</span>
                            </div>
                        </a>
                        <span class="delete-btn" style="position: absolute; right: 10px; top: 12px;" data-action="delete-link" data-section="${index}" data-link="${linkIndex}">✕</span>
                    </div>
                `}).join('')}
            </div>
            <button class="btn-add-link" data-action="open-link-modal" data-index="${index}">+ Add Link</button>
        `;
        sectionsContainer.appendChild(sectionEl);
    });

    setupDragAndDrop();
}

// Drag and Drop Logic
function setupDragAndDrop() {
    const sections = document.querySelectorAll('.section-card');
    const links = document.querySelectorAll('.link-item-wrapper');
    const linkLists = document.querySelectorAll('.links-list');

    sections.forEach(s => addDnDHandlers(s));
    links.forEach(l => addDnDHandlers(l));

    linkLists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            if (dragSrcEl && dragSrcEl.dataset.type === 'link') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                list.classList.add('drag-over');
            }
        });
        list.addEventListener('dragleave', (e) => {
            list.classList.remove('drag-over');
        });
        list.addEventListener('drop', handleDropOnList);
    });
}

function addDnDHandlers(elem) {
    elem.addEventListener('dragstart', handleDragStart);
    elem.addEventListener('dragover', handleDragOver);
    elem.addEventListener('dragenter', handleDragEnter);
    elem.addEventListener('dragleave', handleDragLeave);
    elem.addEventListener('drop', handleDrop);
    elem.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    e.stopPropagation();
    dragSrcEl = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
        type: this.dataset.type,
        index: parseInt(this.dataset.index),
        section: parseInt(this.dataset.section),
        link: parseInt(this.dataset.link)
    }));
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragSrcEl === this) return;

    if (dragSrcEl.dataset.type === this.dataset.type) {
        this.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragEnter(e) { }
function handleDragLeave(e) { this.classList.remove('drag-over'); }

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');

    if (dragSrcEl === this) return;

    const srcType = dragSrcEl.dataset.type;
    const destType = this.dataset.type;

    if (srcType !== destType) return;

    if (srcType === 'section') {
        const srcIndex = parseInt(dragSrcEl.dataset.index);
        const destIndex = parseInt(this.dataset.index);

        const item = sections.splice(srcIndex, 1)[0];
        sections.splice(destIndex, 0, item);

        saveData();
        renderSections();
    } else if (srcType === 'link') {
        const srcSection = parseInt(dragSrcEl.dataset.section);
        const srcLink = parseInt(dragSrcEl.dataset.link);
        const destSection = parseInt(this.dataset.section);
        const destLink = parseInt(this.dataset.link);

        const item = sections[srcSection].links.splice(srcLink, 1)[0];
        sections[destSection].links.splice(destLink, 0, item);

        saveData();
        renderSections();
    }
    return false;
}

function handleDropOnList(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');

    if (!dragSrcEl || dragSrcEl.dataset.type !== 'link') return;

    const srcSection = parseInt(dragSrcEl.dataset.section);
    const srcLink = parseInt(dragSrcEl.dataset.link);
    const destSectionIdx = parseInt(this.dataset.sectionIndex);

    const item = sections[srcSection].links.splice(srcLink, 1)[0];
    sections[destSectionIdx].links.push(item);

    saveData();
    renderSections();
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

function renderIconPicker() {
    iconPicker.innerHTML = ICONS.map(icon => `
        <div class="icon-item" data-icon="${icon}">${icon}</div>
    `).join('');

    iconPicker.addEventListener('click', (e) => {
        const target = e.target.closest('.icon-item');
        if (target) {
            document.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
            target.classList.add('selected');
            sectionIconInput.value = target.dataset.icon;
        }
    });
}

function selectIconInPicker(icon) {
    document.querySelectorAll('.icon-item').forEach(el => {
        if (el.dataset.icon === icon) {
            el.classList.add('selected');
            sectionIconInput.value = icon;
        } else {
            el.classList.remove('selected');
        }
    });
}

// Event Listeners
function setupEventListeners() {
    addSectionBtn.addEventListener('click', () => {
        sectionModalTitle.textContent = 'New Section';
        sectionNameInput.value = '';
        sectionIdEdit.value = '';
        const randomIcon = getRandomIcon();
        selectIconInPicker(randomIcon);
        openModal('section-modal');
    });

    document.getElementById('cancel-section-btn').addEventListener('click', () => closeModal('section-modal'));
    document.getElementById('cancel-link-btn').addEventListener('click', () => closeModal('link-modal'));
    document.getElementById('cancel-tab-picker-btn').addEventListener('click', () => closeModal('tab-picker-modal'));

    document.getElementById('save-tab-picker-btn').addEventListener('click', () => {
        // ... (rest of logic same) ...
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
        } else if (existingIndex !== "") {
            sections[existingIndex].links.push({
                name: title,
                url: url
            });
            saveData();
            renderSections();
            closeModal('tab-picker-modal');
        } else {
            showToast('Please select a section or create a new one.', 'error');
        }
    });

    saveSectionBtn.addEventListener('click', () => {
        const name = sectionNameInput.value.trim();
        const icon = sectionIconInput.value;
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
        }
    });

    saveLinkBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('link-name');
        const urlInput = document.getElementById('link-url');
        const sectionIndex = document.getElementById('link-section-id').value;

        if (nameInput.value.trim() && urlInput.value.trim()) {
            let url = urlInput.value.trim();
            if (!url.startsWith('http')) url = 'https://' + url;

            if (isDuplicateUrl(url)) {
                showToast('This URL is already pinned!', 'error');
                return;
            }

            sections[sectionIndex].links.push({
                name: nameInput.value.trim(),
                url: url
            });
            saveData();
            renderSections();
            closeModal('link-modal');
            nameInput.value = '';
            urlInput.value = '';
        }
    });

    // Old Export/Import listeners removed - moved to settings

    sectionsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const index = target.dataset.index;

        if (action === 'open-link-modal') {
            document.getElementById('link-section-id').value = index;
            openModal('link-modal');
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
            const sIndex = target.dataset.section;
            const lIndex = target.dataset.link;
            deleteLink(sIndex, lIndex);
        }
    });
}

function exportData() {
    const data = JSON.stringify(sections, null, 2);
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
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                showConfirm('Importing will overwrite current links. Continue?', () => {
                    sections = imported.map(s => ({
                        ...s,
                        icon: s.icon || getRandomIcon()
                    }));
                    saveData();
                    renderSections();
                    showToast('Backup restored successfully!', 'success');
                });
            } else {
                showToast('Invalid backup file format.', 'error');
            }
        } catch (err) {
            showToast('Error parsing backup file.', 'error');
        }
    };
    reader.readAsText(file);
}

// Modal Helpers
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Delete Logic
function deleteSection(index) {
    showConfirm('Delete this section and all its links?', () => {
        sections.splice(index, 1);
        saveData();
        renderSections();
        showToast('Section deleted.', 'success');
    });
}

function deleteLink(sIndex, lIndex) {
    sections[sIndex].links.splice(lIndex, 1);
    saveData();
    renderSections();
    showToast('Link removed.', 'info');
}

function initSettings() {
    const settingsBtn = document.getElementById('settings-toggle');
    const closeSettings = document.getElementById('close-settings-btn');
    const testToast = document.getElementById('toast-test-btn');

    // Load saved custom background
    const savedBg = localStorage.getItem('customBg');
    if (savedBg) {
        document.querySelector('.background-overlay').style.backgroundImage = `url('${savedBg}')`;
        document.querySelector('.background-overlay').style.backgroundSize = 'cover';
        document.querySelector('.background-overlay').style.backgroundPosition = 'center';
    }

    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    if (closeSettings) closeSettings.addEventListener('click', () => closeModal('settings-modal'));

    // Data Management
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importInput.click());
    if (importInput) importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importData(file);
    });

    // Custom Background Logic
    const bgUpload = document.getElementById('bg-upload');
    const resetBgBtn = document.getElementById('reset-bg-btn');

    if (bgUpload) {
        bgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit check
                    showToast('Image too large. Max 5MB.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    try {
                        localStorage.setItem('customBg', dataUrl);
                        document.querySelector('.background-overlay').style.backgroundImage = `url('${dataUrl}')`;
                        document.querySelector('.background-overlay').style.backgroundSize = 'cover';
                        document.querySelector('.background-overlay').style.backgroundPosition = 'center';
                        showToast('Background updated!', 'success');
                    } catch (err) {
                        showToast('Failed to save image. It might be too large.', 'error');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            localStorage.removeItem('customBg');
            document.querySelector('.background-overlay').style.backgroundImage = '';
            showToast('Background reset.', 'info');
            if (bgUpload) bgUpload.value = '';
        });
    }

    if (testToast) testToast.addEventListener('click', () => showToast('This is a test notification!', 'success'));

    // Setup Confirm Modal
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
}

function cleanConfirmCallbacks() {
    confirmCallbackYes = null;
    confirmCallbackCancel = null;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        toast.addEventListener('animationend', () => {
            if (toast.parentElement) toast.remove();
        });
    }, 3000);
}

function showConfirm(message, onYes, onCancel) {
    const confirmMsg = document.getElementById('confirm-message');
    if (confirmMsg) confirmMsg.textContent = message;
    confirmCallbackYes = onYes;
    confirmCallbackCancel = onCancel;
    openModal('confirm-modal');
}

// Run
init();
