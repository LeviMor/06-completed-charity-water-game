// Water Bringers Game Prototype
// Beginner-friendly, DOM-based JavaScript

// --- Game Settings ---
const MAP_ROWS = 4;
const MAP_COLS = 5;
const START_FUNDING = 1000;
const START_TIME = 150; // 5 minutes (150 days at 2s per day)
const ACTIONS = [
  { key: 'well', name: 'Build Well', cost: 120, time: 3 },
  { key: 'rainwater', name: 'Install Rainwater Catchments', cost: 90, time: 2 },
  { key: 'gravity', name: 'Implement Gravity Fed Systems', cost: 150, time: 4 },
  { key: 'piped', name: 'Build Piped Systems', cost: 200, time: 5 },
  { key: 'purification', name: 'Install Water Purification Systems', cost: 80, time: 2 },
  { key: 'biosand', name: 'Provide BioSand Filters', cost: 60, time: 1 },
  { key: 'spring', name: 'Construct Spring Protections', cost: 100, time: 3 },
  { key: 'latrines', name: 'Build Latrines', cost: 70, time: 2 }
];

// --- Game State ---
let funding = START_FUNDING;
let timeLeft = START_TIME;
let sustainedCount = 0;
let selectedAction = null;
let selectedTile = null;
let actionsTaken = 0;
let regions = [];
let eventTimeout = null;
let fundingInterval = null; // For funding timer
let turnsSinceLastEvent = 0; // Track turns since last event

// --- DOM Elements ---
const mapGrid = document.getElementById('map-grid');
const fundingSpan = document.getElementById('funding');
const timeSpan = document.getElementById('time');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const actionList = document.getElementById('action-list');
const popup = document.getElementById('popup-message');
const restartBtn = document.getElementById('restart-btn');
const tilePopup = document.getElementById('tile-popup');
const tilePopupContent = document.getElementById('tile-popup-content');
const closeTilePopupBtn = document.getElementById('close-tile-popup');

// --- Helper Functions ---
function randomRegionNeeds() {
  // Each region needs 2-3 random actions to be sustained
  const shuffled = [...ACTIONS].sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
  return shuffled.slice(0, count).map(a => a.key);
}

function createRegions() {
  // Create a 2D array of region objects
  const arr = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      arr.push({
        row: r,
        col: c,
        needs: randomRegionNeeds(),
        completed: [],
        inProgress: null, // {actionKey, turnsLeft}
        sustained: false
      });
    }
  }
  return arr;
}

function updateResourceTracker() {
  fundingSpan.textContent = funding;
  // Show time as days
  timeSpan.textContent = `${timeLeft} days`;
}

function updateProgressBar() {
  // Only count enabled (not disabled) regions
  const enabledRegions = regions.filter(region => !region.disabled);
  const percent = enabledRegions.length === 0 ? 0 : Math.round((sustainedCount / enabledRegions.length) * 100);
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  // Show win popup if 100% and not already shown
  if (percent === 100) {
    showWinPopup();
  }
}

function showPopup(msg, duration = 2000) {
  popup.textContent = msg;
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, duration);
}

function playSound(type) {
  // Placeholder for sound effects (students can add audio later)
}

function getActionName(key) {
  const action = ACTIONS.find(a => a.key === key);
  return action ? action.name : key;
}

function renderMap() {
  mapGrid.innerHTML = '';
  regions.forEach((region, idx) => {
    const tile = document.createElement('div');
    tile.classList.add('tile');
    if (region.disabled) {
      // If this tile is disabled, make it invisible and not clickable
      tile.style.visibility = 'hidden';
      mapGrid.appendChild(tile);
      return;
    }
    // Calculate percent complete
    const total = (region.needs.length + (region.completed ? region.completed.length : 0));
    const completed = region.completed ? region.completed.length : 0;
    let percent = total === 0 ? 1 : completed / total;
    if (region.sustained) {
      tile.classList.add('blue');
    } else if (percent >= 0.5) {
      tile.classList.add('yellow');
    } else {
      tile.classList.add('red');
    }
    tile.dataset.idx = idx;
    tile.textContent = region.sustained ? '✓' : '';
    if (selectedTile === idx) {
      tile.classList.add('selected');
    }
    tile.addEventListener('click', () => {
      if (!selectedAction) {
        showTilePopup(region);
      } else {
        onTileClick(idx);
      }
    });
    mapGrid.appendChild(tile);
  });
}

function showTilePopup(region) {
  // Build the popup content for this region using up-to-date data
  let html = '';
  html += '<b>Needs:</b><br>';
  if (region.needs.length > 0) {
    html += region.needs.map(key => `- ${getActionName(key)}`).join('<br>');
  } else {
    html += 'None!';
  }
  html += '<br><br><b>Completed:</b><br>';
  if (region.completed && region.completed.length > 0) {
    html += region.completed.map(key => `- ${getActionName(key)}`).join('<br>');
  } else {
    html += 'None yet.';
  }
  if (region.sustained) {
    html += '<br><br><b>This region is sustained!</b>';
  }
  tilePopupContent.innerHTML = html;
  tilePopup.style.display = 'block';
}

closeTilePopupBtn.addEventListener('click', function() {
  tilePopup.style.display = 'none';
});

function renderActions() {
  Array.from(actionList.children).forEach(li => {
    li.classList.remove('selected');
    if (li.dataset.action === selectedAction) {
      li.classList.add('selected');
    }
  });
}

function onTileClick(idx) {
  selectedTile = idx;
  renderMap();
  const region = regions[idx];
  // 1. Prevent action if already in progress
  if (region.inProgress) {
    showPopup('You cannot start a new action here until the current one is finished!');
    selectedAction = null;
    renderActions();
    return;
  }
  // 2. Limit to 3 actions in progress at once
  const actionsInProgress = regions.filter(r => r.inProgress).length;
  if (actionsInProgress >= 3) {
    showPopup('You can only have actions happening on 3 regions at a time!');
    selectedAction = null;
    renderActions();
    return;
  }
  if (region.sustained) {
    showPopup('This region is already sustained!');
    selectedAction = null;
    renderActions();
    return;
  }
  if (!selectedAction) {
    showPopup('Select an action from the sidebar first!');
    return;
  }
  if (!region.needs.includes(selectedAction)) {
    showPopup('This action is not needed for this region.');
    selectedAction = null;
    renderActions();
    return;
  }
  const action = ACTIONS.find(a => a.key === selectedAction);
  if (funding < action.cost) {
    showPopup('Not enough funding!');
    selectedAction = null;
    renderActions();
    return;
  }
  funding -= action.cost;
  // Mark action as in progress
  region.inProgress = { actionKey: selectedAction, turnsLeft: action.time };
  actionsTaken++;
  updateResourceTracker();
  renderMap();
  showPopup(`${action.name} started! (${action.time} turns)`);
  selectedAction = null;
  renderActions();
}

function onActionClick(e) {
  const key = e.target.dataset.action;
  // Toggle selection: deselect if already selected
  if (selectedAction === key) {
    selectedAction = null;
  } else {
    selectedAction = key;
  }
  renderActions();
}

function nextTurn() {
  timeLeft--;
  // Only count sustained regions that are enabled
  sustainedCount = regions.filter(region => !region.disabled && region.sustained).length;
  updateResourceTracker();
  updateProgressBar();
  renderMap();
  // Show failure popup if time runs out
  if (timeLeft <= 0) {
    showFailurePopup();
    return;
  }
  regions.forEach(region => {
    if (region.inProgress) {
      region.inProgress.turnsLeft--;
      if (region.inProgress.turnsLeft <= 0) {
        // Move action from needs to completed
        const idx = region.needs.indexOf(region.inProgress.actionKey);
        if (idx !== -1) {
          region.needs.splice(idx, 1);
          if (!region.completed) region.completed = [];
          region.completed.push(region.inProgress.actionKey);
        }
        region.inProgress = null;
        playSound('complete');
        showPopup('Action complete!');
        if (region.needs.length === 0) {
          region.sustained = true;
          sustainedCount++;
          playSound('sustain');
          showPopup('Region sustained!');
        }
      }
    }
  });
  // Trigger a random event after normal turn logic
  triggerRandomEvent();
  updateResourceTracker();
  updateProgressBar();
  renderMap();
}

// Random event logic
function triggerRandomEvent() {
  turnsSinceLastEvent++;
  // Only allow an event every 3 turns at most
  if (turnsSinceLastEvent < 3) return;
  // 10% chance of an event every 3+ turns
  if (Math.random() > 0.1) return;
  turnsSinceLastEvent = 0; // Reset counter if event happens
  // Define named events
  const events = [
    {
      name: 'Heavy Rains Delay',
      desc: 'Unusually heavy rains have made roads impassable. Construction is delayed and you lose 5 days.',
      effect: function() {
        timeLeft = Math.max(0, timeLeft - 5);
      }
    },
    {
      name: 'Unexpected Equipment Costs',
      desc: 'A key piece of equipment broke down and needed urgent replacement. You lose $100 in funding.',
      effect: function() {
        funding = Math.max(0, funding - 100);
        updateResourceTracker();
      }
    },
    {
      name: 'Well Contamination',
      desc: 'A completed well was found to be contaminated and must be redone in one region.',
      effect: function() {
        const eligible = regions.filter(r => !r.disabled && r.completed && r.completed.length > 0);
        if (eligible.length > 0) {
          const region = eligible[Math.floor(Math.random() * eligible.length)];
          const actionIdx = Math.floor(Math.random() * region.completed.length);
          const actionKey = region.completed[actionIdx];
          region.completed.splice(actionIdx, 1);
          region.needs.push(actionKey);
          region.sustained = false;
          renderMap();
        }
      }
    }
  ];
  // Pick a random event
  const event = events[Math.floor(Math.random() * events.length)];
  event.effect();
  showEventPopup(event.name, event.desc);
  updateResourceTracker();
  updateProgressBar();
  renderMap();
}

// Modal popup for random events
function showEventPopup(title, desc) {
  let eventPopup = document.getElementById('event-popup');
  if (!eventPopup) {
    eventPopup = document.createElement('div');
    eventPopup.id = 'event-popup';
    eventPopup.className = 'failure-popup-modal';
    eventPopup.innerHTML = `
      <div class="failure-popup-content">
        <h2 id="event-popup-title"></h2>
        <p id="event-popup-desc"></p>
        <button id="close-event-popup">OK</button>
      </div>
    `;
    document.body.appendChild(eventPopup);
  }
  document.getElementById('event-popup-title').textContent = title;
  document.getElementById('event-popup-desc').textContent = desc;
  eventPopup.style.display = 'flex';
  // Pause game loop while popup is open
  if (eventTimeout) clearInterval(eventTimeout);
  document.getElementById('close-event-popup').onclick = function() {
    eventPopup.style.display = 'none';
    startGameLoop();
  };
}

// Disables a random number (9-14) of hexes at game start
function disableRandomHexes() {
  // First, make sure all regions are enabled
  for (let i = 0; i < regions.length; i++) {
    regions[i].disabled = false;
  }
  // Create an array of all region indices (0, 1, 2, ...)
  const indices = [];
  for (let i = 0; i < regions.length; i++) {
    indices.push(i);
  }
  // Shuffle the indices array so the order is random each time
  for (let i = indices.length - 1; i > 0; i--) {
    // Pick a random index from 0 to i
    const j = Math.floor(Math.random() * (i + 1));
    // Swap indices[i] and indices[j]
    const temp = indices[i];
    indices[i] = indices[j];
    indices[j] = temp;
  }
  // Pick a random number between 9 and 14 (inclusive)
  const numToDisable = 9 + Math.floor(Math.random() * 6); // 9, 10, 11, 12, 13, or 14
  // Disable the first numToDisable regions in the shuffled array
  for (let i = 0; i < numToDisable; i++) {
    regions[indices[i]].disabled = true;
  }
}

function resetGame() {
  funding = START_FUNDING;
  timeLeft = START_TIME;
  sustainedCount = 0;
  selectedAction = null;
  selectedTile = null;
  actionsTaken = 0;
  regions = createRegions();
  disableRandomHexes(); // Disable random hexes on reset
  // Recalculate sustainedCount for enabled regions
  sustainedCount = regions.filter(region => !region.disabled && region.sustained).length;
  updateResourceTracker();
  updateProgressBar();
  renderMap();
  renderActions();
  popup.style.display = 'none';
  if (fundingInterval) clearInterval(fundingInterval);
  startGameLoop(); // Restart intervals
}

// Add a win popup for 100% progress
function showWinPopup() {
  // Create the popup if it doesn't exist
  let winPopup = document.getElementById('win-popup');
  if (!winPopup) {
    winPopup = document.createElement('div');
    winPopup.id = 'win-popup';
    winPopup.className = 'win-popup-modal';
    winPopup.innerHTML = `
      <div class="win-popup-content">
        <h2>Congratulations!</h2>
        <p>You have stabilized clean water access for every region!</p>
        <p>Learn more about our partners over at <a href="https://www.charitywater.org/" target="_blank">charity:water</a>:</p>
        <div class="social-links">
          <a href="https://twitter.com/charitywater" target="_blank">Twitter</a> |
          <a href="https://www.instagram.com/charitywater/" target="_blank">Instagram</a> |
          <a href="https://www.facebook.com/charitywater" target="_blank">Facebook</a>
        </div>
        <div style="margin-top:18px;">
          <button id="win-restart-btn">Restart</button>
          <button id="win-quit-btn">Quit</button>
        </div>
      </div>
    `;
    document.body.appendChild(winPopup);
  } else {
    winPopup.style.display = 'block';
  }
  // Stop the game loop and funding
  if (eventTimeout) clearInterval(eventTimeout);
  if (fundingInterval) clearInterval(fundingInterval);
  // Add event listeners for buttons
  document.getElementById('win-restart-btn').onclick = function() {
    winPopup.style.display = 'none';
    resetGame();
  };
  document.getElementById('win-quit-btn').onclick = function() {
    winPopup.style.display = 'none';
    // Optionally, you could redirect or just hide the popup
  };
}

function showFailurePopup() {
  // If the popup already exists, just show it
  let failPopup = document.getElementById('failure-popup');
  if (!failPopup) {
    failPopup = document.createElement('div');
    failPopup.id = 'failure-popup';
    failPopup.className = 'failure-popup-modal';
    failPopup.innerHTML = `
      <div class="failure-popup-content">
        <h2>Time's Up!</h2>
        <p>Unfortunately, you ran out of time before sustaining all regions.<br>
        This highlights the real-world challenges organizations like charity:water face every day.</p>
        <p>Learn more about our partners over at <a href="https://www.charitywater.org/" target="_blank">charity:water</a>:</p>
        <div class="social-links">
          <a href="https://twitter.com/charitywater" target="_blank">Twitter</a> |
          <a href="https://www.instagram.com/charitywater/" target="_blank">Instagram</a> |
          <a href="https://www.facebook.com/charitywater" target="_blank">Facebook</a>
        </div>
        <button id="fail-restart-btn">Restart</button>
      </div>
    `;
    document.body.appendChild(failPopup);
  } else {
    failPopup.style.display = 'flex';
  }
  // Stop the game loop and funding
  if (eventTimeout) clearInterval(eventTimeout);
  if (fundingInterval) clearInterval(fundingInterval);
  // Add event listener for restart
  document.getElementById('fail-restart-btn').onclick = function() {
    failPopup.style.display = 'none';
    // Reset game state and UI
    funding = START_FUNDING;
    timeLeft = START_TIME;
    sustainedCount = 0;
    selectedAction = null;
    selectedTile = null;
    actionsTaken = 0;
    regions = createRegions();
    disableRandomHexes();
    sustainedCount = regions.filter(region => !region.disabled && region.sustained).length;
    updateResourceTracker();
    updateProgressBar();
    renderMap();
    renderActions();
    popup.style.display = 'none';
    startGameLoop();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('progress-container').style.display = '';
    document.getElementById('menu-buttons').style.display = '';
    document.getElementById('sidebar').style.display = '';
    document.getElementById('game-area').style.display = '';
    document.getElementById('resource-tracker').style.display = '';
  };
}

// --- Event Listeners ---
ACTIONS.forEach(action => {
  const li = document.querySelector(`#action-list li[data-action='${action.key}']`);
  if (li) {
    li.addEventListener('click', onActionClick);
  }
});

// Ensure all event listeners are set up after DOM is loaded
window.onload = function() {
  // Hide game UI, show main menu
  const mainMenu = document.getElementById('main-menu');
  const progressContainer = document.getElementById('progress-container');
  const menuButtons = document.getElementById('menu-buttons');
  const sidebar = document.getElementById('sidebar');
  const gameArea = document.getElementById('game-area');
  const resourceTracker = document.getElementById('resource-tracker');
  if (mainMenu) mainMenu.style.display = 'flex';
  if (progressContainer) progressContainer.style.display = 'none';
  if (menuButtons) menuButtons.style.display = 'none';
  if (sidebar) sidebar.style.display = 'none';
  if (gameArea) gameArea.style.display = 'none';
  if (resourceTracker) resourceTracker.style.display = 'none';

  // Play button
  const playBtn = document.getElementById('play-btn');
  if (playBtn) {
    playBtn.onclick = function() {
      // Always reset all game state before starting
      funding = START_FUNDING;
      timeLeft = START_TIME;
      sustainedCount = 0;
      selectedAction = null;
      selectedTile = null;
      actionsTaken = 0;
      regions = createRegions();
      disableRandomHexes();
      sustainedCount = regions.filter(region => !region.disabled && region.sustained).length;
      updateResourceTracker();
      updateProgressBar();
      renderMap();
      renderActions();
      popup.style.display = 'none';
      if (fundingInterval) clearInterval(fundingInterval);
      if (eventTimeout) clearInterval(eventTimeout);
      if (mainMenu) mainMenu.style.display = 'none';
      if (progressContainer) progressContainer.style.display = '';
      if (menuButtons) menuButtons.style.display = '';
      if (sidebar) sidebar.style.display = '';
      if (gameArea) gameArea.style.display = '';
      if (resourceTracker) resourceTracker.style.display = '';
      startGameLoop(); // Start the game loop and funding
    };
  }

  // Settings button (optional)
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      showPopup('Settings: (Not implemented in this prototype)');
    });
  }
};

// --- Game Loop ---
function startGameLoop() {
  if (eventTimeout) clearInterval(eventTimeout);
  eventTimeout = setInterval(() => {
    // For prototype, just update time and progress
    nextTurn();
  }, 2000); // 2 seconds per turn

  // Give player $100 every 10 seconds
  if (fundingInterval) clearInterval(fundingInterval);
  fundingInterval = setInterval(() => {
    funding += 100;
    updateResourceTracker();
    // Optional: show a message when funding increases
    // showPopup('Received $100 in funding!');
  }, 10000); // 10 seconds
}

// Hide game UI at start, show main menu
window.onload = function() {
  document.getElementById('main-menu').style.display = 'flex';
  document.getElementById('progress-container').style.display = 'none';
  document.getElementById('menu-buttons').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('game-area').style.display = 'none';
  document.getElementById('resource-tracker').style.display = 'none';
};

// Start game when Play is clicked
const playBtn = document.getElementById('play-btn');
if (playBtn) {
  playBtn.onclick = function() {
    // Always reset all game state before starting
    funding = START_FUNDING;
    timeLeft = START_TIME;
    sustainedCount = 0;
    selectedAction = null;
    selectedTile = null;
    actionsTaken = 0;
    regions = createRegions();
    disableRandomHexes();
    sustainedCount = regions.filter(region => !region.disabled && region.sustained).length;
    updateResourceTracker();
    updateProgressBar();
    renderMap();
    renderActions();
    popup.style.display = 'none';
    if (fundingInterval) clearInterval(fundingInterval);
    if (eventTimeout) clearInterval(eventTimeout);
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('progress-container').style.display = '';
    document.getElementById('menu-buttons').style.display = '';
    document.getElementById('sidebar').style.display = '';
    document.getElementById('game-area').style.display = '';
    document.getElementById('resource-tracker').style.display = '';
    startGameLoop(); // Start the game loop and funding
  };
}
