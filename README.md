# ZenTab Dashboard

A premium, minimal Chrome extension that replaces your default New Tab page with a beautiful, productive dashboard.

![ZenTab Preview](icon128.png)

## Features

- **Dynamic Interface**: Real-time clock and personalized greetings.
- **Pinned Links**: Quick access to your favorite sites with host-name detection.
- **Categorized Sections**: Organize your links into custom-named groups.
- **Layout Control**: Choose how many section cards sit side by side (2–5, or auto-fit).
- **Foldable Sections**: Collapse individual cards by clicking a header, or fold/unfold every card at once from the top-right toolbar.
- **Link Previews**: Hover a link card (or focus it with the keyboard) to see a quick preview of its name, domain, and full URL.
- **Modern Design**: A dark-themed, glassmorphic UI with crisp Outfit typography and multiple theme presets, including Dracula.
- **Sync With Local Fallback**: Sections are chunked across `chrome.storage.sync` keys so large dashboards keep syncing. If sync is unavailable (quota, signed out), changes fall back to `chrome.storage.local` instead of being lost.

## Installation

To use this extension in developer mode:

1. Clone or download this repository.
2. Open Google Chrome.
3. Navigate to `chrome://extensions/`.
4. Turn on **Developer mode** (the toggle in the top right).
5. Click the **Load unpacked** button.
6. Select the folder containing this extension's files.

## Usage

### Managing Sections
- **Add Section**: Click the "Section" button next to the search bar.
- **Edit/Delete**: Hover over a section title to see the edit (✎) and delete (✕) icons.
- **Fold/Unfold**: Click a section header (or its chevron) to collapse that card. Use the **Fold** button in the top-right corner to collapse or expand all cards at once.
- **Link Preview**: Hover over or keyboard-focus a link to see its name, domain, and full URL in a floating preview.

### Pinning Links
- **Manual Add**: Click "+ Add Link" inside any section to manually enter a name and URL.
- **Quick Add from Open Tabs**:
    1. Click the menu icon (☰) in the top-left corner to open the **Open Tabs Sidebar**.
    2. Browse your currently open tabs and click "+ Add to Section".
    3. Choose an existing section from the dropdown or type a name to create a new one instantly.

### Backup and Sync
- **Export**: Use "Export Backup" to save your dashboard layout to a JSON file.
- **Import**: Use "Import Backup" to restore your links from a previous backup. Imports are validated: non-web URLs, duplicate links, and malformed entries are skipped.
- **Sync**: Since it uses Chrome Sync, your links will follow you to any computer where you're signed into Chrome.

### Themes
- Use the quick toggle in the top-right corner to switch between **Light Mode** and your most recent dark preset.
- Open Settings to choose a theme preset (including **Dracula**) and set how many section cards appear per row (**Auto**, or **2–5**).

## Technology Stack

- **HTML5**: Semantic structure.
- **CSS3**: Modern layouts with Flexbox/Grid and custom transitions.
- **JavaScript**: Pure Vanilla JS for state management and DOM manipulation.
- **Chrome API**: Manifest V3, storage, and New Tab overrides.
- **Outfit**: Bundled variable UI font, licensed under the SIL Open Font License (`fonts/Outfit-OFL.txt`).

## Author

**Saurav Sarma**
