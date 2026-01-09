// Icons dictionary (Emojis for simplicity and variety, can be replaced with SVGs if needed)
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

// Initialize
function init() {
    updateTime();
    setInterval(updateTime, 1000);
    loadData();
    setupEventListeners();
    renderIconPicker();
    initTheme();
    initSidebar();
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
        // Mock data for local testing
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
    // Filter out internal pages and newtabs
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

    // Add event listeners for "Add to Section"
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

    // Reset fields
    newSectionInput.value = '';
    urlInput.value = url;
    titleInput.value = title;

    // Populate dropdown
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
        // Fallback for local testing
        const saved = localStorage.getItem('zenTabSections');
        sections = saved ? JSON.parse(saved) : [];
        // Migration: add icons to existing sections
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

// Rendering
function renderSections() {
    sectionsContainer.innerHTML = '';

    sections.forEach((section, index) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-card';
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
            <div class="links-list">
                ${section.links.map((link, linkIndex) => `
                    <div class="link-item-wrapper" style="position: relative;">
                        <a href="${link.url}" class="link-item">
                            <div class="link-info">
                                <span class="link-name">${link.name}</span>
                                <span class="link-url">${new URL(link.url).hostname}</span>
                            </div>
                        </a>
                        <span class="delete-btn" style="position: absolute; right: 10px; top: 12px;" data-action="delete-link" data-section="${index}" data-link="${linkIndex}">✕</span>
                    </div>
                `).join('')}
            </div>
            <button class="btn-add-link" data-action="open-link-modal" data-index="${index}">+ Add Link</button>
        `;
        sectionsContainer.appendChild(sectionEl);
    });
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
        const existingIndex = document.getElementById('existing-section-select').value;
        const newName = document.getElementById('new-section-name').value.trim();
        const url = document.getElementById('tab-to-add-url').value;
        const title = document.getElementById('tab-to-add-title').value;

        if (isDuplicateUrl(url)) {
            alert('This URL is already pinned in one of your sections!');
            return;
        }

        if (newName) {
            // Create new section
            sections.push({
                name: newName,
                icon: getRandomIcon(),
                links: [{ name: title, url: url }]
            });
            saveData();
            renderSections();
            closeModal('tab-picker-modal');
        } else if (existingIndex !== "") {
            // Add to existing
            sections[existingIndex].links.push({
                name: title,
                url: url
            });
            saveData();
            renderSections();
            closeModal('tab-picker-modal');
        } else {
            alert('Please select an existing section or type a new section name.');
        }
    });

    saveSectionBtn.addEventListener('click', () => {
        const name = sectionNameInput.value.trim();
        const icon = sectionIconInput.value;
        const editIndex = sectionIdEdit.value;

        if (name) {
            if (editIndex !== '') {
                // Edit existing
                sections[editIndex].name = name;
                sections[editIndex].icon = icon;
            } else {
                // Add new
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
                alert('This URL is already pinned in one of your sections!');
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

    // Backup & Restore
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-input').click();
    });
    document.getElementById('import-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importData(file);
    });

    // Event Delegation for dynamic elements
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
                if (confirm('Importing will overwrite your current links. Continue?')) {
                    sections = imported.map(s => ({
                        ...s,
                        icon: s.icon || getRandomIcon()
                    }));
                    saveData();
                    renderSections();
                    alert('Backup restored successfully!');
                }
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Error parsing backup file.');
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
    if (confirm('Delete this section and all its links?')) {
        sections.splice(index, 1);
        saveData();
        renderSections();
    }
}

function deleteLink(sIndex, lIndex) {
    sections[sIndex].links.splice(lIndex, 1);
    saveData();
    renderSections();
}

// Run
init();
