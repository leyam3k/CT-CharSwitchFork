# CozyTavern Character Switcher (Fork)

A unified quick switcher for characters and groups, conveniently integrated into the chat input bar of SillyTavern/CozyTavern. This fork (CT-CharSwitchFork) reimagines the UI with a purple-ish glassmorphism theme and improved positioning.

## Features

- **Unified Access**: Browse both Characters and Groups in a single, easy-to-navigate list.
- **Smart Views**: Quickly toggle between **Recents** (default), **Favorites**, and **All** entities.
- **Search & Seek**: Instantly filter by name using the search bar or jump to a letter using the A-Z seek bar.
- **Local Randomizer**: Click the dice button (🎲) to instantly switch to a random character from your current filtered view.
- **Integrated Design**: Sits neatly in the chat input bar as a book icon, using a distinct purple theme with glassmorphism effects.

## Installation and Usage

### Installation

1.  Open SillyTavern.
2.  Navigate to **Extensions** > **Install Extension**.
3.  Paste the repository URL: `https://github.com/leyam3k/CT-CharSwitchFork`
4.  Click **Install**.

### Usage

1.  Look for the **Book Icon** button in your chat input bar (near the send button area).
2.  Click it to open the switcher popup.
3.  **Tabs**: Switch between 'Recents', 'Favorites', and 'All' using the top buttons.
4.  **Search**: Type in the search box to filter the list.
5.  **Seek**: Click a letter on the right side to jump to that section (visible in 'Favorites' and 'All' views).
6.  **Switch**: Click on any character or group to switch to them immediately.
7.  **Random**: Click the 🎲 button next to the search bar to let fate decide your next chat partner from the current list.

## Prerequisites

- SillyTavern (Latest release recommended)

## Support and Contributions

If you encounter any issues or have suggestions, please open an issue on the GitHub repository.

## Changelog

### v1.1.0
- **Sidebar Integration**: Button now registers with CT-SidebarButtons extension instead of being placed in the leftSendForm
- **Improved Dropdown Positioning**: Dropdown now appears to the left of the sidebar buttons with 8px spacing for better space utilization on smaller devices
- **Smart Fallback Placement**: Added Popper flip modifier to automatically adjust position when viewport space is limited

### v1.0.0
- Initial fork release
- Unified quick switcher for characters and groups
- Purple glassmorphism theme
- Smart views: Recents, Favorites, All
- Search & A-Z seek bar functionality
- Local randomizer (🎲) for random character selection

## License

This project is open-source.
