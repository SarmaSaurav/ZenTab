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

// Initialize
function init() {
    updateTime();
    setInterval(updateTime, 1000);
    loadData();
    setupEventListeners();
    renderIconPicker();
    initTheme();
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
