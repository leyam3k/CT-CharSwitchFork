import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    characters,
    this_chid,
    selectCharacterById,
    setActiveCharacter,
    setActiveGroup,
    getEntitiesList,
} from "../../../../script.js";

import { groups, selected_group, openGroupById } from "../../../group-chats.js";

jQuery(() => {
    // ---------------------------------------------------------------------------------
    //  State Management
    // ---------------------------------------------------------------------------------
    let isDropdownOpen = false;
    let currentView = 'recents';
    let currentSearchTerm = '';
    let currentActiveEntity = null;

    // ---------------------------------------------------------------------------------
    //  DOM Element Creation
    // ---------------------------------------------------------------------------------
    const $unifiedSwitchBtn = $('<button id="unifiedSwitchBtn" title="Quick Character Switch">⚡</button>');
    $('body').append($unifiedSwitchBtn);

    // ---------------------------------------------------------------------------------
    //  Data Fetching & Processing Helpers
    // ---------------------------------------------------------------------------------
    const getCurrentActiveEntity = () => {
        return characters[this_chid] ?? groups.find(it => it.id === selected_group);
    };

    const getUnifiedEntities = () => {
        if (typeof getEntitiesList === 'function') {
            return getEntitiesList({ doFilter: false });
        }
        console.warn("UnifiedSwitch: Using fallback getEntitiesList.");
        const charEntities = characters.map((char, index) => ({ id: index, item: char, type: 'char' }));
        const groupEntities = groups.map(group => ({ id: group.id, item: group, type: 'group' }));
        return [...charEntities, ...groupEntities];
    };

    const getRecentEntities = () => {
        const allItems = [...characters, ...groups];
        return allItems
            .filter(item => (item.avatar ?? item.id) !== (currentActiveEntity?.avatar ?? currentActiveEntity?.id))
            .sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0))
            .slice(0, 50);
    };

    const filterOutActiveEntity = (entity) => {
        if (!currentActiveEntity) return true;
        const item = entity.item;
        let isActive = false;
        if (item.members && entity.type === 'group') isActive = entity.id === selected_group;
        else if (!item.members && entity.type === 'char') isActive = entity.id === this_chid;
        return !isActive;
    };

    const getFavoriteEntities = () => {
        return getUnifiedEntities()
            .filter(entity => {
                const isFavorite = entity.item.fav === true || entity.item.fav === 'true';
                return isFavorite && filterOutActiveEntity(entity);
            })
            .sort((a, b) => (a.item.name || '').toLowerCase().localeCompare((b.item.name || '').toLowerCase()));
    };

    const getAllEntities = () => {
        return getUnifiedEntities()
            .filter(filterOutActiveEntity)
            .sort((a, b) => (a.item.name || '').toLowerCase().localeCompare((b.item.name || '').toLowerCase()));
    };

    const getAvatarUrl = (item) => {
        if (item.avatar) return `/thumbnail?type=avatar&file=${encodeURIComponent(item.avatar)}`;
        if (item.members) {
            const members = [...(item.members ?? []), ...(item.disabled_members ?? [])].filter((it, idx, list) => idx === list.indexOf(it));
            if (members.length > 0) return `/thumbnail?type=avatar&file=${encodeURIComponent(members[0])}`;
        }
        return '/img/five.png';
    };
    
    // ---------------------------------------------------------------------------------
    //  Action Helpers
    // ---------------------------------------------------------------------------------
    
    /**
     * Injects a slash command into the main chat input, sends it, and restores previous text.
     * @param {string} cmd The slash command to execute (e.g., '/reminisce').
     */
    const fireSlashCommand = (cmd) => {
        const $ta = $("#send_textarea");
        if (!$ta.length) {
            console.error('UnifiedSwitch: Could not find chat textarea #send_textarea.');
            return;
        }
        const prev = $ta.val();
        $ta.val(cmd).trigger("input");
        $("#send_but").click();
        setTimeout(() => $ta.val(prev).trigger("input"), 100);
    };

    // ---------------------------------------------------------------------------------
    //  UI Rendering Functions
    // ---------------------------------------------------------------------------------
    const createListItem = (entity) => {
        const item = entity.item ?? entity;
        const itemId = entity.id ?? characters.indexOf(item);

// ADD THIS LINE:
const $listItem = $('<li class="unified-switch-item"></li>');
if (item.fav === true || item.fav === 'true') $listItem.addClass('unified-switch-favorite');

// Add this line to create the tooltip
$listItem.attr('title', item.name); 

        const name = (item.name || '').trim().toLowerCase();
        const firstChar = name.charAt(0);
        const letter = firstChar.match(/[a-z]/) ? firstChar : '#';
        $listItem.attr('data-letter', letter);
        
        const avatarUrl = getAvatarUrl(item);
        const $avatar = $(`<div class="unified-switch-avatar" style="background-image: url('${avatarUrl}')"></div>`);
        const $name = $(`<div class="unified-switch-name"></div>`).text(item.name);
        $listItem.append($avatar, $name);

        $listItem.on('click', async () => {
            try {
                if (item.members) {
                    setActiveCharacter(null);
                    setActiveGroup(item.id);
                    openGroupById(item.id);
                } else {
                    setActiveCharacter(itemId);
                    setActiveGroup(null);
                    selectCharacterById(itemId);
                }
                saveSettingsDebounced();
            } catch (error) {
                console.error('UnifiedSwitch: Error during switch:', error);
            }
        });
        return $listItem;
    };

    const populateListContainer = async () => {
        const $list = $('.unified-switch-list');
        if (!$list.length) return;

        $list.empty().append('<div class="unified-switch-loader">Loading...</div>');

        let baseEntities;
        switch (currentView) {
            case 'favorites': baseEntities = getFavoriteEntities(); break;
            case 'all': baseEntities = getAllEntities(); break;
            case 'recents': default: baseEntities = getRecentEntities(); break;
        }

        let filteredEntities = baseEntities;
        if (currentSearchTerm) {
            filteredEntities = baseEntities.filter(entity => {
                const item = entity.item ?? entity;
                return (item.name || '').toLowerCase().includes(currentSearchTerm);
            });
        }

        $list.empty();

        if (filteredEntities.length === 0) {
            let emptyMessage = 'No matches found.';
            if (!currentSearchTerm) {
                switch (currentView) {
                    case 'recents': emptyMessage = 'No recent chats found.'; break;
                    case 'favorites': emptyMessage = 'No favorite characters. Add some!'; break;
                    case 'all': emptyMessage = 'No characters found.'; break;
                }
            }
            $list.append(`<li class="unified-switch-empty">${emptyMessage}</li>`);
        } else {
            for (const entity of filteredEntities) {
                const $listItem = createListItem(entity);
                $list.append($listItem);
            }
        }
    };
    
    const setStableDropdownHeight = () => {
        const $dropdown = $('.unified-switch-dropdown');
        if ($dropdown.length && !$dropdown.css('min-height')) {
            const initialHeight = $dropdown.outerHeight();
            $dropdown.css('min-height', `${initialHeight}px`);
        }
    };

    // ---------------------------------------------------------------------------------
    //  Main Dropdown Controller Functions
    // ---------------------------------------------------------------------------------

    const createDropdownMenu = async () => {
        if (isDropdownOpen) return;

        isDropdownOpen = true;
        currentView = 'recents';
        currentSearchTerm = '';
        currentActiveEntity = getCurrentActiveEntity();

        const $backdrop = $('<div class="unified-switch-backdrop"></div>');
        const $dropdown = $('<div class="unified-switch-dropdown"></div>');
        
        // MODIFIED: Create containers for the top bar layout
        const $toggleContainer = $('<div class="unified-switch-toggle-container"></div>');
        const $viewTogglesWrapper = $('<div class="unified-switch-view-toggles"></div>');
        const $recentsBtn = $('<button id="unified-switch-toggle-recents" class="active">Recents</button>');
        const $favoritesBtn = $('<button id="unified-switch-toggle-favorites">Favorites</button>');
        const $allBtn = $('<button id="unified-switch-toggle-all">All</button>');
        const $reminisceBtn = $('<button id="unified-switch-reminisce-btn" title="Reminisce (Random Story)">✨</button>'); // NEW: Reminisce button

        // MODIFIED: Create search container and its contents
        const $searchContainer = $('<div class="unified-switch-search-container"></div>');
        const $searchInput = $('<input type="text" id="unified-switch-search-input" placeholder="Filter by name..." autocomplete="off">');
        const $localRandomBtn = $('<button id="unified-switch-local-random-btn" title="Switch to Random in List">🎲</button>'); // NEW: Local random button
        
        const $contentWrapper = $('<div class="unified-switch-content-wrapper"></div>');
        const $charList = $('<ul class="unified-switch-list"></ul>');
        const $seekBar = $('<ul class="unified-switch-seek-bar hidden"></ul>');

        const letters = ['#', ...'abcdefghijklmnopqrstuvwxyz'];
        letters.forEach(letter => {
            $seekBar.append($(`<li class="unified-switch-seek-letter" data-target-letter="${letter}">${letter}</li>`));
        });

        // MODIFIED: Assemble the new top bar and search bar layouts
        $viewTogglesWrapper.append($recentsBtn, $favoritesBtn, $allBtn);
        $toggleContainer.append($viewTogglesWrapper, $reminisceBtn);
        $searchContainer.append($searchInput, $localRandomBtn); 
        $contentWrapper.append($charList, $seekBar);
        $dropdown.append($toggleContainer, $searchContainer, $contentWrapper);
        $backdrop.append($dropdown);
        $('body').append($backdrop);

        const btnRect = $unifiedSwitchBtn[0].getBoundingClientRect();
        $dropdown.css({
            'top': `${btnRect.bottom + 5}px`,
            'right': `${window.innerWidth - btnRect.right}px`
        });

        // Attach event handlers
        $recentsBtn.on('click', () => handleToggleClick('recents'));
        $favoritesBtn.on('click', () => handleToggleClick('favorites'));
        $allBtn.on('click', () => handleToggleClick('all'));
        $searchInput.on('input', handleSearchInput);
        $seekBar.on('click', '.unified-switch-seek-letter', handleSeekClick);
        
        // NEW: Event handler for the top-bar Reminisce button
        $reminisceBtn.on('click', () => {
            console.log('UnifiedSwitch: Firing /reminisce command.');
            fireSlashCommand('/reminisce');
            closeDropdown();
        });

        // NEW: Event handler for the filter-area Local Random button
        $localRandomBtn.on('click', handleLocalRandomClick);

        await populateListContainer();
        setStableDropdownHeight();
        attachDropdownCloseHandlers();
        
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isTouchDevice) {
            $searchInput.focus();
        }
	}

    const closeDropdown = () => {
        if (!isDropdownOpen) return;
        $('.unified-switch-backdrop').remove();
        isDropdownOpen = false;
        currentSearchTerm = '';
        $(document).off('.unifiedSwitchClose');
    };

    // ---------------------------------------------------------------------------------
    //  Event Handlers
    // ---------------------------------------------------------------------------------

    const handleToggleClick = (targetView) => {
        if (currentView === targetView) return;
        
        currentView = targetView;
        currentSearchTerm = '';
        $('#unified-switch-search-input').val('');

        $('#unified-switch-toggle-recents').toggleClass('active', currentView === 'recents');
        $('#unified-switch-toggle-favorites').toggleClass('active', currentView === 'favorites');
        $('#unified-switch-toggle-all').toggleClass('active', currentView === 'all');

        const $seekBar = $('.unified-switch-seek-bar');
        const showSeekBar = (currentView === 'favorites' || currentView === 'all') && !currentSearchTerm;
        $seekBar.toggleClass('hidden', !showSeekBar);

        populateListContainer();
    };

    const handleSeekClick = (event) => {
        const targetLetter = $(event.currentTarget).data('target-letter');
        const $listContainer = $('.unified-switch-list');
        const $targetItem = $listContainer.find(`.unified-switch-item[data-letter="${targetLetter}"]`).first();

        if ($targetItem.length) {
            const scrollTop = $listContainer.scrollTop();
            const itemTop = $targetItem.position().top;
            const listPaddingTop = parseInt($listContainer.css('padding-top'), 10) || 0;
            $listContainer.scrollTop(scrollTop + itemTop - listPaddingTop);
        }
    };
    
    const handleSearchInput = (event) => {
        currentSearchTerm = $(event.target).val().toLowerCase().trim();
        const showSeekBar = (currentView === 'favorites' || currentView === 'all') && !currentSearchTerm;
        $('.unified-switch-seek-bar').toggleClass('hidden', !showSeekBar);
        populateListContainer();
    };

    // NEW: Handler for the local random button (🎲)
    /**
     * Finds all visible character items in the current list, picks one at random,
     * and triggers a click on it to switch to that chat.
     */
    const handleLocalRandomClick = () => {
        // Query the DOM for all currently visible and selectable items
        const $items = $('.unified-switch-list .unified-switch-item');

        if ($items.length === 0) {
            console.log('UnifiedSwitch: No items in the list to randomize.');
            return; // Do nothing if the list is empty
        }

        // Select a random item from the list
        const randomIndex = Math.floor(Math.random() * $items.length);
        const $randomItem = $items.eq(randomIndex);

        const randomCharName = $randomItem.find('.unified-switch-name').text();
        console.log(`UnifiedSwitch: Randomly selected "${randomCharName}". Triggering click.`);

        // Trigger the existing click handler on the item.
        // This will automatically handle the character switch and close the dropdown.
        $randomItem.trigger('click');
    };

    const attachDropdownCloseHandlers = () => {
        $(document).on('click.unifiedSwitchClose touchstart.unifiedSwitchClose', (e) => {
            if (isDropdownOpen && !$(e.target).closest('.unified-switch-dropdown, #unifiedSwitchBtn').length) {
                closeDropdown();
            }
        });

        $(document).on('keydown.unifiedSwitchClose', (e) => {
            if (e.key === 'Escape' && isDropdownOpen) {
                closeDropdown();
            }
        });
    };

    $unifiedSwitchBtn.on('click touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDropdownOpen ? closeDropdown() : createDropdownMenu();
    });

    eventSource.on(event_types.CHARACTER_EDITED, () => {
        if (isDropdownOpen) populateListContainer();
    });

    eventSource.on(event_types.CHARACTER_PAGE_LOADED, () => {
        if (!$('#unifiedSwitchBtn').length) $('body').append($unifiedSwitchBtn);
    });
});