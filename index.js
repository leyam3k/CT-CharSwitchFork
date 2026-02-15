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
import { Popper } from "../../../../lib.js";

jQuery(() => {
  // ---------------------------------------------------------------------------------
  //  State Management
  // ---------------------------------------------------------------------------------
  let popper = null;
  let isDropdownOpen = false;
  let currentView = "recents";
  let currentSearchTerm = "";
  let currentActiveEntity = null;

  // Button ID used in CTSidebarButtons
  const BUTTON_ID = "ct-charswitch";
  const BUTTON_SELECTOR = "#ct-sidebar-btn-" + BUTTON_ID;

  // ---------------------------------------------------------------------------------
  //  Button Registration with CTSidebarButtons
  // ---------------------------------------------------------------------------------
  const registerSidebarButton = () => {
    // Check if CTSidebarButtons API is available
    if (typeof window.CTSidebarButtons === "undefined") {
      console.warn(
        "CT-CharSwitch: CTSidebarButtons not found. Retrying in 500ms..."
      );
      setTimeout(registerSidebarButton, 500);
      return;
    }

    // Register button with CTSidebarButtons
    window.CTSidebarButtons.registerButton({
      id: BUTTON_ID,
      icon: "fa-solid fa-address-book",
      title: "Quick Character Switch",
      order: 10,
      onClick: () => {
        isDropdownOpen ? closeDropdown() : createDropdownMenu();
      },
    });

    console.log("CT-CharSwitch: Button registered with CTSidebarButtons");
  };

  // ---------------------------------------------------------------------------------
  //  Data Fetching & Processing Helpers
  // ---------------------------------------------------------------------------------
  const getCurrentActiveEntity = () => {
    return (
      characters[this_chid] ?? groups.find((it) => it.id === selected_group)
    );
  };

  const getUnifiedEntities = () => {
    if (typeof getEntitiesList === "function") {
      return getEntitiesList({ doFilter: false });
    }
    console.warn("CT-CharSwitch: Using fallback getEntitiesList.");
    const charEntities = characters.map((char, index) => ({
      id: index,
      item: char,
      type: "char",
    }));
    const groupEntities = groups.map((group) => ({
      id: group.id,
      item: group,
      type: "group",
    }));
    return [...charEntities, ...groupEntities];
  };

  const getRecentEntities = () => {
    const allItems = [...characters, ...groups];
    return allItems
      .filter(
        (item) =>
          (item.avatar ?? item.id) !==
          (currentActiveEntity?.avatar ?? currentActiveEntity?.id)
      )
      .sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0))
      .slice(0, 50);
  };

  const filterOutActiveEntity = (entity) => {
    if (!currentActiveEntity) return true;
    const item = entity.item;
    let isActive = false;
    if (item.members && entity.type === "group")
      isActive = entity.id === selected_group;
    else if (!item.members && entity.type === "char")
      isActive = entity.id === this_chid;
    return !isActive;
  };

  const getFavoriteEntities = () => {
    return getUnifiedEntities()
      .filter((entity) => {
        const isFavorite =
          entity.item.fav === true || entity.item.fav === "true";
        return isFavorite && filterOutActiveEntity(entity);
      })
      .sort((a, b) =>
        (a.item.name || "")
          .toLowerCase()
          .localeCompare((b.item.name || "").toLowerCase())
      );
  };

  const getAllEntities = () => {
    return getUnifiedEntities()
      .filter(filterOutActiveEntity)
      .sort((a, b) =>
        (a.item.name || "")
          .toLowerCase()
          .localeCompare((b.item.name || "").toLowerCase())
      );
  };

  const getAvatarUrl = (item) => {
    if (item.avatar)
      return `/thumbnail?type=avatar&file=${encodeURIComponent(item.avatar)}`;
    if (item.members) {
      const members = [
        ...(item.members ?? []),
        ...(item.disabled_members ?? []),
      ].filter((it, idx, list) => idx === list.indexOf(it));
      if (members.length > 0)
        return `/thumbnail?type=avatar&file=${encodeURIComponent(members[0])}`;
    }
    return "/img/five.png";
  };

  // ---------------------------------------------------------------------------------
  //  UI Rendering Functions
  // ---------------------------------------------------------------------------------
  const createListItem = (entity) => {
    const item = entity.item ?? entity;
    const itemId = entity.id ?? characters.indexOf(item);

    const $listItem = $('<li class="ct-charswitch-item"></li>');
    if (item.fav === true || item.fav === "true")
      $listItem.addClass("ct-charswitch-favorite");

    $listItem.attr("title", item.name);

    const name = (item.name || "").trim().toLowerCase();
    const firstChar = name.charAt(0);
    const letter = firstChar.match(/[a-z]/) ? firstChar : "#";
    $listItem.attr("data-letter", letter);

    const avatarUrl = getAvatarUrl(item);
    const $avatar = $(
      `<div class="ct-charswitch-avatar" style="background-image: url('${avatarUrl}')"></div>`
    );
    const $name = $(`<div class="ct-charswitch-name"></div>`).text(item.name);
    $listItem.append($avatar, $name);

    $listItem.on("click", async () => {
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
        closeDropdown();
      } catch (error) {
        console.error("CT-CharSwitch: Error during switch:", error);
      }
    });
    return $listItem;
  };

  const populateListContainer = async () => {
    const $list = $(".ct-charswitch-list");
    if (!$list.length) return;

    $list.empty().append('<div class="ct-charswitch-loader">Loading...</div>');

    let baseEntities;
    switch (currentView) {
      case "favorites":
        baseEntities = getFavoriteEntities();
        break;
      case "all":
        baseEntities = getAllEntities();
        break;
      case "recents":
      default:
        baseEntities = getRecentEntities();
        break;
    }

    let filteredEntities = baseEntities;
    if (currentSearchTerm) {
      filteredEntities = baseEntities.filter((entity) => {
        const item = entity.item ?? entity;
        return (item.name || "").toLowerCase().includes(currentSearchTerm);
      });
    }

    $list.empty();

    if (filteredEntities.length === 0) {
      let emptyMessage = "No matches found.";
      if (!currentSearchTerm) {
        switch (currentView) {
          case "recents":
            emptyMessage = "No recent chats found.";
            break;
          case "favorites":
            emptyMessage = "No favorite characters. Add some!";
            break;
          case "all":
            emptyMessage = "No characters found.";
            break;
        }
      }
      $list.append(`<li class="ct-charswitch-empty">${emptyMessage}</li>`);
    } else {
      for (const entity of filteredEntities) {
        const $listItem = createListItem(entity);
        $list.append($listItem);
      }
    }
  };

  // ---------------------------------------------------------------------------------
  //  Main Dropdown Controller Functions
  // ---------------------------------------------------------------------------------

  const createDropdownMenu = async () => {
    if (isDropdownOpen) return;

    isDropdownOpen = true;
    currentView = "recents";
    currentSearchTerm = "";
    currentActiveEntity = getCurrentActiveEntity();

    const $dropdown = $('<div class="ct-charswitch-dropdown"></div>');

    const $toggleContainer = $(
      '<div class="ct-charswitch-toggle-container"></div>'
    );
    const $viewTogglesWrapper = $(
      '<div class="ct-charswitch-view-toggles"></div>'
    );
    const $recentsBtn = $(
      '<button id="ct-charswitch-toggle-recents" class="active">Recents</button>'
    );
    const $favoritesBtn = $(
      '<button id="ct-charswitch-toggle-favorites">Favorites</button>'
    );
    const $allBtn = $('<button id="ct-charswitch-toggle-all">All</button>');

    const $searchContainer = $(
      '<div class="ct-charswitch-search-container"></div>'
    );
    const $searchInput = $(
      '<input type="text" id="ct-charswitch-search-input" placeholder="Filter by name..." autocomplete="off">'
    );
    const $localRandomBtn = $(
      '<button id="ct-charswitch-local-random-btn" title="Switch to Random in List">🎲</button>'
    );

    const $contentWrapper = $(
      '<div class="ct-charswitch-content-wrapper"></div>'
    );
    const $charList = $('<ul class="ct-charswitch-list"></ul>');
    const $seekBar = $('<ul class="ct-charswitch-seek-bar hidden"></ul>');

    const letters = ["#", ..."abcdefghijklmnopqrstuvwxyz"];
    letters.forEach((letter) => {
      $seekBar.append(
        $(
          `<li class="ct-charswitch-seek-letter" data-target-letter="${letter}">${letter}</li>`
        )
      );
    });

    $viewTogglesWrapper.append($recentsBtn, $favoritesBtn, $allBtn);
    $toggleContainer.append($viewTogglesWrapper);
    $searchContainer.append($searchInput, $localRandomBtn);
    $contentWrapper.append($charList, $seekBar);
    $dropdown.append($toggleContainer, $searchContainer, $contentWrapper);

    $("body").append($dropdown);

    // Attach event handlers
    $recentsBtn.on("click", () => handleToggleClick("recents"));
    $favoritesBtn.on("click", () => handleToggleClick("favorites"));
    $allBtn.on("click", () => handleToggleClick("all"));
    $searchInput.on("input", handleSearchInput);
    $seekBar.on("click", ".ct-charswitch-seek-letter", handleSeekClick);
    $localRandomBtn.on("click", handleLocalRandomClick);

    await populateListContainer();
    attachDropdownCloseHandlers();

    // Initialize Popper - use the button from CTSidebarButtons
    const $sidebarBtn = $(BUTTON_SELECTOR);
    if ($sidebarBtn.length === 0) {
      console.error("CT-CharSwitch: Button not found in sidebar");
      closeDropdown();
      return;
    }
    
    // Position dropdown to the left of sidebar buttons with spacing
    // This provides better space utilization on smaller devices
    popper = Popper.createPopper(
      $sidebarBtn[0],
      $dropdown[0],
      {
        placement: "left-start",
        modifiers: [
          {
            name: "offset",
            options: {
              // [skid, distance] - positive skid moves down, distance adds horizontal spacing
              // Position lower to align better with sidebar button position
              offset: [150, 8],
            },
          },
          {
            name: "preventOverflow",
            options: {
              boundary: "viewport",
            },
          },
          {
            name: "flip",
            options: {
              fallbackPlacements: ["left-end", "right-start", "right-end"],
            },
          },
        ],
      }
    );
  };

  const closeDropdown = () => {
    if (!isDropdownOpen) return;
    $(".ct-charswitch-dropdown").remove();
    isDropdownOpen = false;
    currentSearchTerm = "";
    $(document).off(".ctCharSwitchClose");

    if (popper) {
      popper.destroy();
      popper = null;
    }
  };

  // ---------------------------------------------------------------------------------
  //  Event Handlers
  // ---------------------------------------------------------------------------------

  const handleToggleClick = (targetView) => {
    if (currentView === targetView) return;

    currentView = targetView;
    currentSearchTerm = "";
    $("#ct-charswitch-search-input").val("");

    $("#ct-charswitch-toggle-recents").toggleClass(
      "active",
      currentView === "recents"
    );
    $("#ct-charswitch-toggle-favorites").toggleClass(
      "active",
      currentView === "favorites"
    );
    $("#ct-charswitch-toggle-all").toggleClass("active", currentView === "all");

    const $seekBar = $(".ct-charswitch-seek-bar");
    const showSeekBar =
      (currentView === "favorites" || currentView === "all") &&
      !currentSearchTerm;
    $seekBar.toggleClass("hidden", !showSeekBar);

    populateListContainer();
  };

  const handleSeekClick = (event) => {
    const targetLetter = $(event.currentTarget).data("target-letter");
    const $listContainer = $(".ct-charswitch-list");
    const $targetItem = $listContainer
      .find(`.ct-charswitch-item[data-letter="${targetLetter}"]`)
      .first();

    if ($targetItem.length) {
      const scrollTop = $listContainer.scrollTop();
      const itemTop = $targetItem.position().top;
      const listPaddingTop =
        parseInt($listContainer.css("padding-top"), 10) || 0;
      $listContainer.scrollTop(scrollTop + itemTop - listPaddingTop);
    }
  };

  const handleSearchInput = (event) => {
    currentSearchTerm = $(event.target).val().toLowerCase().trim();
    const showSeekBar =
      (currentView === "favorites" || currentView === "all") &&
      !currentSearchTerm;
    $(".ct-charswitch-seek-bar").toggleClass("hidden", !showSeekBar);
    populateListContainer();
  };

  const handleLocalRandomClick = () => {
    const $items = $(".ct-charswitch-list .ct-charswitch-item");

    if ($items.length === 0) {
      console.log("CT-CharSwitch: No items in the list to randomize.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * $items.length);
    const $randomItem = $items.eq(randomIndex);
    const randomCharName = $randomItem.find(".ct-charswitch-name").text();
    console.log(
      `CT-CharSwitch: Randomly selected "${randomCharName}". Triggering click.`
    );
    $randomItem.trigger("click");
  };

  const attachDropdownCloseHandlers = () => {
    $(document).on(
      "click.ctCharSwitchClose touchstart.ctCharSwitchClose",
      (e) => {
        if (
          isDropdownOpen &&
          !$(e.target).closest(`.ct-charswitch-dropdown, ${BUTTON_SELECTOR}`)
            .length
        ) {
          closeDropdown();
        }
      }
    );

    $(document).on("keydown.ctCharSwitchClose", (e) => {
      if (e.key === "Escape" && isDropdownOpen) {
        closeDropdown();
      }
    });
  };

  eventSource.on(event_types.CHARACTER_EDITED, () => {
    if (isDropdownOpen) populateListContainer();
  });

  // Register button with CTSidebarButtons on load
  registerSidebarButton();

  // Also try to register on APP_READY in case CTSidebarButtons loads later
  eventSource.on(event_types.APP_READY, () => {
    registerSidebarButton();
  });
});
