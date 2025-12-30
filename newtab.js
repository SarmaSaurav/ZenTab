// State management
let sections = [];

// DOM Elements
const clockElement = document.getElementById('clock');
const greetingElement = document.getElementById('greeting');
const sectionsContainer = document.getElementById('sections-container');
const addSectionBtn = document.getElementById('add-section-btn');
const saveSectionBtn = document.getElementById('save-section-btn');
const saveLinkBtn = document.getElementById('save-link-btn');

// Initialize
function init() {
    updateTime();
    setInterval(updateTime, 1000);
    loadData();
    setupEventListeners();
}

// Time & Greeting
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
            sections = result.sections || [];
            renderSections();
        });
    } else {
        // Fallback for local testing
        const saved = localStorage.getItem('zenTabSections');
        sections = saved ? JSON.parse(saved) : [];
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
                <h2 class="section-title">${section.name}</h2>
                <span class="delete-btn" data-action="delete-section" data-index="${index}">✕</span>
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

// Event Listeners
function setupEventListeners() {
    addSectionBtn.addEventListener('click', () => openModal('section-modal'));

    document.getElementById('cancel-section-btn').addEventListener('click', () => closeModal('section-modal'));
    document.getElementById('cancel-link-btn').addEventListener('click', () => closeModal('link-modal'));

    saveSectionBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('section-name');
        if (nameInput.value.trim()) {
            sections.push({
                name: nameInput.value.trim(),
                links: []
            });
            saveData();
            renderSections();
            closeModal('section-modal');
            nameInput.value = '';
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

    // Event Delegation for dynamic elements
    sectionsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;

        if (action === 'open-link-modal') {
            const index = target.dataset.index;
            document.getElementById('link-section-id').value = index;
            openModal('link-modal');
        } else if (action === 'delete-section') {
            const index = target.dataset.index;
            deleteSection(index);
        } else if (action === 'delete-link') {
            const sIndex = target.dataset.section;
            const lIndex = target.dataset.link;
            deleteLink(sIndex, lIndex);
        }
    });
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

