(() => {
  const canvas = document.querySelector('[data-frog-rpg]');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const logicalWidth = 960;
  const logicalHeight = 600;
  const worldWidth = 2800;
  const worldHeight = 1900;
  const tileSize = 60;
  const saveKey = 'adnf-frog-farmyard-quest-v1';
  const camera = { x: 0, y: 0 };
  const dom = {
    announce: document.querySelector('[data-game-announce]'),
    quest: document.querySelector('[data-quest-text]'),
    zone: document.querySelector('[data-game-zone]'),
    hearts: document.querySelector('[data-game-hearts]'),
    treats: document.querySelector('[data-game-treats]'),
    day: document.querySelector('[data-game-day]'),
    companion: document.querySelector('[data-game-companion]'),
    start: document.querySelector('[data-game-start]'),
    interact: document.querySelector('[data-game-interact]'),
    map: document.querySelector('[data-game-map]'),
    journal: document.querySelector('[data-game-journal]'),
    reset: document.querySelector('[data-game-reset]')
  };

  const player = { x: 720, y: 1020, radius: 23, direction: 0 };
  const gardenLayout = [
    { id: 'garden-one', x: 510, y: 1280 },
    { id: 'garden-two', x: 600, y: 1280 },
    { id: 'garden-three', x: 510, y: 1365 },
    { id: 'garden-four', x: 600, y: 1365 }
  ];
  const companion = { x: 655, y: 1060, direction: 0 };
  const landmark = { x: 1575, y: 1495, name: 'Old Story Stone' };

  function freshGarden() {
    return gardenLayout.map((plot) => ({ id: plot.id, phase: 'empty', watered: false }));
  }

  const state = {
    started: false,
    running: false,
    mapOpen: false,
    journalOpen: false,
    dialog: null,
    toast: null,
    keys: new Set(),
    touchKeys: new Set(),
    lastDirection: null,
    queuedDirection: null,
    movement: null,
    stage: 0,
    petals: 0,
    treats: 0,
    friendship: 0,
    day: 1,
    clock: 8,
    seeds: 4,
    moonberries: 0,
    harvests: 0,
    companion: false,
    loreFound: false,
    garden: freshGarden(),
    taken: new Set(),
    lastTime: 0
  };
  const pond = { x: 2375, y: 1250, rx: 410, ry: 315 };
  const solids = [
    { x: 320, y: 245, w: 485, h: 345 },
    { x: 105, y: 1170, w: 330, h: 270 },
    { x: 1835, y: 210, w: 420, h: 250 },
    { x: 2375, y: 320, w: 265, h: 185 }
  ];

  const items = [
    { id: 'petal-one', type: 'petal', label: 'Lily petal', x: 1930, y: 965 },
    { id: 'petal-two', type: 'petal', label: 'Lily petal', x: 2690, y: 960 },
    { id: 'petal-three', type: 'petal', label: 'Lily petal', x: 2705, y: 1565 },
    { id: 'treat-one', type: 'treat', label: 'Lost treat', x: 1280, y: 1450 },
    { id: 'treat-two', type: 'treat', label: 'Lost treat', x: 1765, y: 585 },
    { id: 'treat-three', type: 'treat', label: 'Lost treat', x: 2610, y: 570 }
  ];

  const npcs = [
    { id: 'dad', name: 'Dad', type: 'farmer', x: 835, y: 670 },
    { id: 'pip', name: 'Pip the Pond Frog', type: 'frog', x: 1905, y: 1480 },
    { id: 'bunny', name: 'Benny Bunny', type: 'bunny', x: 1400, y: 980 },
    { id: 'hen', name: 'Hazel Hen', type: 'hen', x: 2300, y: 610 }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey));
      if (!saved || typeof saved !== 'object') return;
      state.stage = clamp(Number(saved.stage) || 0, 0, 6);
      state.petals = clamp(Number(saved.petals) || 0, 0, 3);
      state.treats = clamp(Number(saved.treats) || 0, 0, 3);
      state.friendship = clamp(Number(saved.friendship) || 0, 0, 7);
      state.day = clamp(Number(saved.day) || 1, 1, 999);
      state.clock = clamp(Number(saved.clock) || 8, 0, 24);
      state.seeds = clamp(Number(saved.seeds) || 0, 0, 99);
      state.moonberries = clamp(Number(saved.moonberries) || 0, 0, 99);
      state.harvests = clamp(Number(saved.harvests) || 0, 0, 99);
      state.companion = Boolean(saved.companion);
      state.loreFound = Boolean(saved.loreFound);
      if (Array.isArray(saved.taken)) state.taken = new Set(saved.taken);
      if (Array.isArray(saved.garden)) {
        state.garden = gardenLayout.map((plot) => {
          const stored = saved.garden.find((entry) => entry && entry.id === plot.id);
          return {
            id: plot.id,
            phase: stored && ['empty', 'seeded', 'growing', 'ready'].includes(stored.phase) ? stored.phase : 'empty',
            watered: Boolean(stored && stored.watered)
          };
        });
      }
    } catch (error) {
      localStorage.removeItem(saveKey);
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(saveKey, JSON.stringify({
        stage: state.stage,
        petals: state.petals,
        treats: state.treats,
        friendship: state.friendship,
        day: state.day,
        clock: state.clock,
        seeds: state.seeds,
        moonberries: state.moonberries,
        harvests: state.harvests,
        companion: state.companion,
        loreFound: state.loreFound,
        garden: state.garden,
        taken: [...state.taken]
      }));
    } catch (error) {
      // The adventure still works when a browser blocks local storage.
    }
  }

  function currentQuest() {
    if (state.stage === 0) return 'Explore the farm and find Pip at Happy Pond.';
    if (state.stage === 1) return 'Find shimmering lily petals: ' + state.petals + ' / 3.';
    if (state.stage === 2) return 'Return the lily petals to Pip at Happy Pond.';
    if (state.stage === 3) return 'Visit Dad near the red barn.';
    if (state.stage === 4) return 'Find Dad’s lost treats: ' + state.treats + ' / 3.';
    if (state.stage === 5) return 'Take the lost treats back to Dad.';
    return 'Main quest complete! Grow Moonberries and discover every corner of Frog’s world.';
  }

  function timeOfDay() {
    if (state.clock < 5 || state.clock >= 20) return 'Night';
    if (state.clock < 11) return 'Morning';
    if (state.clock < 17) return 'Afternoon';
    return 'Evening';
  }

  function trailblazerLevel() {
    return 1 + Math.floor((state.friendship + state.harvests + (state.companion ? 1 : 0)) / 3);
  }

  function zoneName() {
    if (player.x < 1050) return 'Barnyard';
    if (player.x < 1900 && player.y > 880) return 'Wildflower Meadow';
    if (player.x >= 1900 && player.y >= 710) return 'Happy Pond';
    return 'Hilltop Village';
  }

  function updateUi() {
    dom.quest.textContent = currentQuest();
    dom.zone.textContent = zoneName();
    dom.hearts.textContent = String(state.friendship);
    dom.treats.textContent = state.treats + ' / 3';
    dom.day.textContent = 'Day ' + state.day + ' · ' + timeOfDay();
    dom.companion.textContent = state.companion ? 'Puddlehop' : 'Searching';
    dom.start.textContent = state.started ? 'Resume adventure' : 'Start adventure';
    dom.map.textContent = state.mapOpen ? 'Close map' : 'Map';
    dom.journal.textContent = state.journalOpen ? 'Close journal' : 'Journal';
  }

  function announce(message) {
    if (dom.announce) dom.announce.textContent = message;
  }

  function showToast(message) {
    state.toast = { text: message, until: performance.now() + 2600 };
    announce(message);
  }

  function say(title, message) {
    state.dialog = { title, message };
    announce(title + ': ' + message);
  }

  function beginAdventure() {
    state.started = true;
    state.running = true;
    state.mapOpen = false;
    state.journalOpen = false;
    canvas.focus({ preventScroll: true });
    updateUi();
    if (!state.dialog) {
      say('Frog', 'The farm is full of places to explore. I wonder who I will meet today?');
    }
  }

  function resetAdventure() {
    state.stage = 0;
    state.petals = 0;
    state.treats = 0;
    state.friendship = 0;
    state.day = 1;
    state.clock = 8;
    state.seeds = 4;
    state.moonberries = 0;
    state.harvests = 0;
    state.companion = false;
    state.loreFound = false;
    state.garden = freshGarden();
    state.taken = new Set();
    state.dialog = null;
    state.mapOpen = false;
    state.journalOpen = false;
    player.x = 720;
    player.y = 1020;
    player.direction = 0;
    companion.x = 655;
    companion.y = 1060;
    try {
      localStorage.removeItem(saveKey);
    } catch (error) {
      // No action needed when storage is unavailable.
    }
    updateUi();
    showToast('A brand-new adventure begins!');
  }

  function nearestNpc() {
    let nearest = null;
    let nearestDistance = Infinity;
    npcs.forEach((npc) => {
      const nextDistance = distance(player, npc);
      if (nextDistance < nearestDistance) {
        nearest = npc;
        nearestDistance = nextDistance;
      }
    });
    return nearestDistance < 100 ? nearest : null;
  }

  function nearestGardenPlot() {
    let nearest = null;
    let nearestDistance = Infinity;
    state.garden.forEach((plot) => {
      const layout = gardenLayout.find((entry) => entry.id === plot.id);
      const nextDistance = Math.hypot(player.x - layout.x, player.y - layout.y);
      if (nextDistance < nearestDistance) {
        nearest = plot;
        nearestDistance = nextDistance;
      }
    });
    return nearestDistance < 112 ? nearest : null;
  }

  function nearCottage() {
    return Math.hypot(player.x - 265, player.y - 1485) < 118;
  }

  function nearLandmark() {
    return Math.hypot(player.x - landmark.x, player.y - landmark.y) < 100;
  }

  function tendGarden(plot) {
    if (plot.phase === 'empty') {
      if (state.seeds < 1) {
        showToast('The garden needs a Moonberry seed.');
        return;
      }
      plot.phase = 'seeded';
      plot.watered = false;
      state.seeds -= 1;
      saveProgress();
      updateUi();
      showToast('Moonberry seed planted. Water it next!');
      return;
    }
    if ((plot.phase === 'seeded' || plot.phase === 'growing') && !plot.watered) {
      plot.watered = true;
      saveProgress();
      showToast('The Moonberry plant is watered. A new day will help it grow.');
      return;
    }
    if (plot.phase === 'ready') {
      plot.phase = 'empty';
      plot.watered = false;
      state.moonberries += 3;
      state.harvests += 1;
      state.seeds += 1;
      state.friendship += 1;
      saveProgress();
      updateUi();
      showToast('Harvested 3 Moonberries and found a fresh seed!');
      return;
    }
    showToast('This Moonberry plant is growing. Water it if it looks thirsty, then rest until tomorrow.');
  }

  function growGarden() {
    let changed = false;
    state.garden.forEach((plot) => {
      if (plot.phase === 'seeded' && plot.watered) {
        plot.phase = 'growing';
        plot.watered = false;
        changed = true;
      } else if (plot.phase === 'growing' && plot.watered) {
        plot.phase = 'ready';
        plot.watered = false;
        changed = true;
      }
    });
    return changed;
  }

  function startNewDay(showMessage) {
    state.day += 1;
    state.clock = 7;
    const gardenChanged = growGarden();
    saveProgress();
    updateUi();
    if (showMessage) {
      say('A new farm day', gardenChanged ? 'The sun is up, and your watered Moonberries have grown. Check the garden!' : 'A fresh morning brings fresh possibilities.');
    } else {
      showToast('Day ' + state.day + ' begins on the farm.');
    }
  }

  function restAtCottage() {
    startNewDay(true);
  }

  function readStoryStone() {
    if (!state.loreFound) {
      state.loreFound = true;
      state.friendship += 1;
      saveProgress();
      updateUi();
      say('Old Story Stone', 'A gentle farm legend whispers: the bravest paths are made one kind step at a time.');
      return;
    }
    say('Old Story Stone', 'Its old words still glow: one kind step, then another.');
  }

  function talkTo(npc) {
    if (npc.id === 'pip') {
      if (state.stage === 0) {
        state.stage = 1;
        saveProgress();
        updateUi();
        say('Pip the Pond Frog', 'Ribbit! Welcome, Frog. Three lily petals drifted around the pond. Find them, and we can make a friendship crown.');
        return;
      }
      if (state.stage === 1) {
        say('Pip the Pond Frog', 'The lily petals shimmer near the pond’s edge. You have ' + state.petals + ' of 3.');
        return;
      }
      if (state.stage === 2) {
        state.stage = 3;
        state.friendship += 1;
        state.companion = true;
        companion.x = player.x - 42;
        companion.y = player.y + 36;
        saveProgress();
        updateUi();
        say('Pip the Pond Frog', 'You found every petal! The crown is splendid. Puddlehop wants to join your adventures and help gather nearby treasures. Dad could use a brave helper near the red barn.');
        return;
      }
      say('Pip the Pond Frog', 'Every adventure is better with a friend. Keep following your brave heart!');
      return;
    }

    if (npc.id === 'dad') {
      if (state.stage === 0) {
        say('Dad', 'There is a whole wide farm out there, Frog. Happy Pond is just past the meadow.');
        return;
      }
      if (state.stage === 3) {
        state.stage = 4;
        saveProgress();
        updateUi();
        say('Dad', 'Your friendship crown looks wonderful! Oh dear, three of my special treats rolled away. Could you help find them?');
        return;
      }
      if (state.stage === 4) {
        say('Dad', 'The treats could be anywhere: the meadow, the hilltop village, or near Hazel’s coop. You have ' + state.treats + ' of 3.');
        return;
      }
      if (state.stage === 5) {
        state.stage = 6;
        state.friendship += 2;
        saveProgress();
        updateUi();
        say('Dad', 'You did it, Frog! You are a true Farmyard Trailblazer. The whole farm is lucky to have you.');
        return;
      }
      say('Dad', 'I am proud of the adventurous dog you are becoming, Frog.');
      return;
    }

    if (npc.id === 'bunny') {
      say('Benny Bunny', state.stage < 3 ? 'Pip lives by Happy Pond. Follow the blue water past the meadow!' : 'I saw a tasty treat roll toward the sunny meadow. My ears never miss a bounce!');
      return;
    }

    say('Hazel Hen', state.stage < 4 ? 'Cluck cluck! There are lots of friendly places to see beyond the barn.' : 'Cluck! I saw something biscuit-shaped near my coop. It was very bouncy.');
  }

  function interact() {
    if (!state.started) {
      beginAdventure();
      return;
    }
    if (state.dialog) {
      state.dialog = null;
      announce('Dialogue closed. Keep exploring Frog’s world.');
      return;
    }
    if (state.mapOpen) {
      state.mapOpen = false;
      updateUi();
      return;
    }
    if (state.journalOpen) {
      state.journalOpen = false;
      return;
    }
    const npc = nearestNpc();
    if (npc) {
      talkTo(npc);
      return;
    }
    const plot = nearestGardenPlot();
    if (plot) {
      tendGarden(plot);
      return;
    }
    if (nearCottage()) {
      restAtCottage();
      return;
    }
    if (nearLandmark()) {
      readStoryStone();
      return;
    }
    showToast('Explore, tend the garden, or walk close to a friend and interact.');
  }

  function isInPond(x, y) {
    const inside = ((x - pond.x) * (x - pond.x)) / (pond.rx * pond.rx) + ((y - pond.y) * (y - pond.y)) / (pond.ry * pond.ry) < 1;
    const onBridge = x > 2050 && x < 2675 && y > 1194 && y < 1318;
    return inside && !onBridge;
  }

  function isBlocked(x, y) {
    if (x < player.radius || y < player.radius || x > worldWidth - player.radius || y > worldHeight - player.radius) return true;
    if (isInPond(x, y)) return true;
    return solids.some((solid) => x > solid.x - player.radius && x < solid.x + solid.w + player.radius && y > solid.y - player.radius && y < solid.y + solid.h + player.radius);
  }

  const directionVectors = {
    up: { x: 0, y: -1, angle: -Math.PI / 2 },
    down: { x: 0, y: 1, angle: Math.PI / 2 },
    left: { x: -1, y: 0, angle: Math.PI },
    right: { x: 1, y: 0, angle: 0 }
  };

  function heldDirection() {
    if (state.lastDirection && (state.keys.has(state.lastDirection) || state.touchKeys.has(state.lastDirection))) return state.lastDirection;
    return [...state.touchKeys, ...state.keys].find((direction) => directionVectors[direction]) || null;
  }

  function startTileMove(direction, time) {
    const vector = directionVectors[direction];
    if (!vector) return false;
    const targetX = player.x + vector.x * tileSize;
    const targetY = player.y + vector.y * tileSize;
    player.direction = vector.angle;
    if (isBlocked(targetX, targetY)) {
      showToast('Frog cannot go that way. Try another path!');
      return false;
    }
    state.movement = { fromX: player.x, fromY: player.y, targetX, targetY, startedAt: time, duration: 145 };
    return true;
  }

  function requestTileMove(direction) {
    if (!directionVectors[direction]) return;
    state.lastDirection = direction;
    if (!state.started) beginAdventure();
    if (state.movement) {
      state.queuedDirection = direction;
      return;
    }
    startTileMove(direction, performance.now());
  }

  function updatePlayerMovement(time) {
    if (!state.movement) {
      const nextDirection = state.queuedDirection || heldDirection();
      state.queuedDirection = null;
      if (nextDirection) startTileMove(nextDirection, time);
      return;
    }
    const progress = clamp((time - state.movement.startedAt) / state.movement.duration, 0, 1);
    player.x = state.movement.fromX + (state.movement.targetX - state.movement.fromX) * progress;
    player.y = state.movement.fromY + (state.movement.targetY - state.movement.fromY) * progress;
    if (progress === 1) {
      state.movement = null;
      const nextDirection = state.queuedDirection || heldDirection();
      state.queuedDirection = null;
      if (nextDirection) startTileMove(nextDirection, time);
    }
  }

  function itemIsActive(item) {
    return item.type === 'petal' ? state.stage === 1 : state.stage === 4;
  }

  function updateCompanion(delta) {
    if (!state.companion) return;
    const nearbyTreasure = items.find((item) => !state.taken.has(item.id) && itemIsActive(item) && distance(player, item) < 255);
    const target = nearbyTreasure || {
      x: player.x - Math.cos(player.direction) * 58,
      y: player.y - Math.sin(player.direction) * 58
    };
    const dx = target.x - companion.x;
    const dy = target.y - companion.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 3) {
      const amount = Math.min(gap, 175 * delta);
      companion.x += (dx / gap) * amount;
      companion.y += (dy / gap) * amount;
      companion.direction = Math.atan2(dy, dx);
    }
  }

  function collectItem(item, helper) {
    state.taken.add(item.id);
    state.friendship += 1;
    if (item.type === 'petal') {
      state.petals += 1;
      if (state.petals === 3) {
        state.stage = 2;
        say('Frog', 'All three lily petals are safe! Pip will be so happy.');
      } else {
        showToast((helper ? 'Puddlehop found a ' : '') + 'Lily petal! ' + state.petals + ' / 3');
      }
    } else {
      state.treats += 1;
      if (state.treats === 3) {
        state.stage = 5;
        say('Frog', 'Every lost treat is found. Time to take them back to Dad!');
      } else {
        showToast((helper ? 'Puddlehop found a ' : '') + 'Lost treat! ' + state.treats + ' / 3');
      }
    }
    saveProgress();
    updateUi();
  }

  function collectItems() {
    items.forEach((item) => {
      if (state.taken.has(item.id) || !itemIsActive(item)) return;
      const frogFoundIt = distance(player, item) <= 38;
      const companionFoundIt = state.companion && distance(companion, item) <= 32;
      if (frogFoundIt || companionFoundIt) collectItem(item, companionFoundIt && !frogFoundIt);
    });
  }

  function advanceClock(delta) {
    state.clock += delta * .24;
    if (state.clock >= 24) startNewDay(false);
  }

  function updateCamera() {
    camera.x = clamp(player.x - logicalWidth / 2, 0, worldWidth - logicalWidth);
    camera.y = clamp(player.y - logicalHeight / 2, 0, worldHeight - logicalHeight);
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function ellipse(x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function label(text, x, y) {
    ctx.save();
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width + 22;
    roundedRect(x - width / 2, y - 13, width, 26, 13);
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  function drawTree(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(4, 33, 28, 10, 'rgba(36,91,58,.18)');
    ctx.fillStyle = '#8b5c3c';
    roundedRect(-6, -4, 12, 35, 4);
    ctx.fill();
    ellipse(-12, -10, 25, 24, '#4f994d');
    ellipse(12, -12, 25, 26, '#5eac53');
    ellipse(0, -30, 28, 25, '#75b956');
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ellipse(-8, -38, 10, 7, 'rgba(255,255,255,.18)');
    ctx.restore();
  }

  function drawBarn(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(240, 345, 275, 35, 'rgba(45,99,54,.18)');
    ctx.fillStyle = '#d9553f';
    roundedRect(20, 110, 430, 220, 10);
    ctx.fill();
    ctx.fillStyle = '#a83831';
    ctx.beginPath();
    ctx.moveTo(-5, 118);
    ctx.lineTo(235, -30);
    ctx.lineTo(475, 118);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8df';
    ctx.fillRect(203, 188, 90, 142);
    ctx.fillStyle = '#6d4031';
    ctx.fillRect(215, 200, 66, 130);
    ctx.strokeStyle = '#fff8df';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(222, 208);
    ctx.lineTo(275, 319);
    ctx.moveTo(275, 208);
    ctx.lineTo(222, 319);
    ctx.stroke();
    ctx.fillStyle = '#fff8df';
    roundedRect(205, 47, 60, 51, 4);
    ctx.fill();
    ctx.strokeStyle = '#d9553f';
    ctx.lineWidth = 5;
    ctx.strokeRect(216, 57, 38, 31);
    ctx.fillStyle = '#f5c653';
    ctx.fillRect(80, 175, 55, 35);
    ctx.fillRect(335, 175, 55, 35);
    ctx.restore();
  }

  function drawCottage(x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(150, 220, 185, 25, 'rgba(45,99,54,.14)');
    ctx.fillStyle = color;
    roundedRect(22, 75, 250, 130, 13);
    ctx.fill();
    ctx.fillStyle = '#9a4c38';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(145, 0);
    ctx.lineTo(295, 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff4c9';
    ctx.fillRect(114, 129, 55, 76);
    ctx.fillStyle = '#7d4b39';
    ctx.fillRect(126, 140, 31, 65);
    ctx.fillStyle = '#f5c653';
    roundedRect(51, 118, 40, 34, 7);
    ctx.fill();
    roundedRect(202, 118, 40, 34, 7);
    ctx.fill();
    ctx.restore();
  }

  function drawWindmill(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(58, 195, 70, 14, 'rgba(45,99,54,.16)');
    ctx.fillStyle = '#d9d6b3';
    ctx.beginPath();
    ctx.moveTo(30, 187);
    ctx.lineTo(84, 187);
    ctx.lineTo(72, 60);
    ctx.lineTo(43, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8f5c45';
    ctx.fillRect(32, 40, 50, 18);
    ctx.translate(57, 44);
    ctx.rotate(.2);
    ctx.fillStyle = '#faf4dd';
    for (let blade = 0; blade < 4; blade += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(9, -9);
      ctx.lineTo(76, -22);
      ctx.lineTo(62, 0);
      ctx.closePath();
      ctx.fill();
    }
    ellipse(0, 0, 9, 9, '#8f5c45');
    ctx.restore();
  }

  function drawPond() {
    ctx.save();
    ellipse(pond.x, pond.y, pond.rx + 17, pond.ry + 15, '#76b551');
    ellipse(pond.x, pond.y, pond.rx, pond.ry, '#69bfd6', '#3a91ac');
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,.42)';
    for (let wave = 0; wave < 5; wave += 1) {
      ctx.beginPath();
      ctx.arc(pond.x - 150 + wave * 78, pond.y - 55 + (wave % 2) * 100, 24, Math.PI * .05, Math.PI * .95);
      ctx.stroke();
    }
    const lilyPads = [
      [-210, -95, 24], [-95, -175, 21], [115, -145, 26], [235, -35, 24],
      [182, 150, 28], [-45, 192, 24], [-255, 108, 22], [36, 20, 20]
    ];
    lilyPads.forEach(([dx, dy, size]) => {
      ellipse(pond.x + dx, pond.y + dy, size, size * .68, '#4f9c50');
      ctx.fillStyle = '#f5c653';
      ctx.beginPath();
      ctx.arc(pond.x + dx + 4, pond.y + dy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#b98752';
    roundedRect(2040, 1200, 650, 108, 10);
    ctx.fill();
    ctx.strokeStyle = '#79503b';
    ctx.lineWidth = 7;
    for (let bridge = 0; bridge < 7; bridge += 1) {
      const x = 2070 + bridge * 94;
      ctx.beginPath();
      ctx.moveTo(x, 1206);
      ctx.lineTo(x, 1301);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPetal(x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t / 270 + x) * 3);
    ctx.rotate(t / 1000);
    ctx.fillStyle = '#fff4c8';
    for (let petal = 0; petal < 5; petal += 1) {
      ctx.rotate(Math.PI * 2 / 5);
      ellipse(0, -9, 6, 12, '#fff4c8');
    }
    ellipse(0, 0, 6, 6, '#f5c653');
    ctx.restore();
  }

  function drawTreat(x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t / 250 + x) * 3);
    ctx.rotate(.24);
    ctx.fillStyle = '#d79351';
    roundedRect(-21, -8, 42, 16, 7);
    ellipse(-22, -7, 8, 8, '#e9b16d');
    ellipse(-22, 7, 8, 8, '#e9b16d');
    ellipse(22, -7, 8, 8, '#e9b16d');
    ellipse(22, 7, 8, 8, '#e9b16d');
    ctx.restore();
  }

  function drawDog(x, y, scale, direction, highlight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(direction);
    ctx.scale(scale, scale);
    ellipse(2, 23, 34, 10, 'rgba(37,67,56,.2)');
    ctx.strokeStyle = '#251e1b';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 4);
    ctx.quadraticCurveTo(46, -13, 54, -3);
    ctx.stroke();
    ellipse(4, 5, 29, 22, '#2c2524');
    ellipse(-19, -8, 24, 22, '#2c2524');
    ellipse(-25, -30, 14, 20, '#201a1a');
    ellipse(-5, -29, 13, 20, '#201a1a');
    ctx.fillStyle = '#e49432';
    ellipse(-34, -2, 15, 10, '#e49432');
    ellipse(-19, 15, 12, 8, '#e49432');
    ellipse(19, 16, 12, 8, '#e49432');
    ellipse(-25, -15, 6, 3, '#e49432');
    ellipse(-10, -15, 6, 3, '#e49432');
    ctx.strokeStyle = '#e24638';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(-4, -2, 21, .35, 2.65);
    ctx.stroke();
    ctx.fillStyle = '#f5c653';
    ctx.beginPath();
    ctx.arc(-2, 7, 4, 0, Math.PI * 2);
    ctx.fill();
    ellipse(-30, -8, 7, 8, '#fff');
    ellipse(-31, -7, 3, 4, '#231d1c');
    ellipse(-43, -2, 5, 4, '#201a1a');
    ctx.fillStyle = '#e94c54';
    ctx.beginPath();
    ctx.arc(-30, 5, 6, 0, Math.PI);
    ctx.fill();
    if (highlight) {
      ctx.strokeStyle = '#fff9da';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(4, 5, 39, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrogNpc(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(0, 25, 25, 8, 'rgba(37,67,56,.18)');
    ellipse(0, 4, 23, 18, '#5cab57');
    ellipse(-12, -13, 10, 12, '#77c25f');
    ellipse(12, -13, 10, 12, '#77c25f');
    ellipse(-12, -14, 5, 6, '#fff');
    ellipse(12, -14, 5, 6, '#fff');
    ellipse(-11, -13, 2, 3, '#203a30');
    ellipse(11, -13, 2, 3, '#203a30');
    ctx.strokeStyle = '#203a30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 2, 9, .15, Math.PI - .15);
    ctx.stroke();
    ctx.restore();
  }

  function drawFarmer(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(0, 29, 21, 7, 'rgba(37,67,56,.18)');
    ctx.fillStyle = '#315a80';
    roundedRect(-14, 0, 28, 28, 8);
    ctx.fill();
    ellipse(0, -15, 16, 18, '#f5bd90');
    ctx.fillStyle = '#9d5a32';
    roundedRect(-20, -33, 40, 8, 4);
    ctx.fill();
    roundedRect(-12, -43, 24, 14, 5);
    ctx.fill();
    ctx.strokeStyle = '#70402d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -9, 6, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawBunny(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(0, 26, 21, 7, 'rgba(37,67,56,.18)');
    ellipse(0, 4, 18, 21, '#d9d1c7');
    ellipse(-8, -25, 7, 21, '#e3ddd4');
    ellipse(8, -25, 7, 21, '#e3ddd4');
    ellipse(-8, -26, 3, 13, '#f5b4bb');
    ellipse(8, -26, 3, 13, '#f5b4bb');
    ellipse(-7, -8, 4, 5, '#fff');
    ellipse(7, -8, 4, 5, '#fff');
    ellipse(-7, -8, 2, 3, '#253837');
    ellipse(7, -8, 2, 3, '#253837');
    ctx.restore();
  }

  function drawHen(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ellipse(0, 20, 23, 7, 'rgba(37,67,56,.18)');
    ellipse(0, 0, 19, 17, '#f6f0da');
    ellipse(13, -12, 12, 13, '#fff7e3');
    ctx.fillStyle = '#dc6e47';
    ellipse(14, -26, 3, 5, '#dc6e47');
    ellipse(20, -24, 3, 5, '#dc6e47');
    ellipse(26, -22, 3, 5, '#dc6e47');
    ctx.fillStyle = '#f5b43e';
    ctx.beginPath();
    ctx.moveTo(25, -12);
    ctx.lineTo(35, -9);
    ctx.lineTo(25, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGarden() {
    ctx.save();
    ctx.translate(450, 1215);
    ellipse(120, 190, 175, 22, 'rgba(45,99,54,.15)');
    ctx.fillStyle = '#f1d29b';
    roundedRect(-20, -8, 290, 182, 15);
    ctx.fill();
    ctx.strokeStyle = '#9b704b';
    ctx.lineWidth = 5;
    ctx.strokeRect(-8, 4, 266, 158);
    state.garden.forEach((plot) => {
      const layout = gardenLayout.find((entry) => entry.id === plot.id);
      const x = layout.x - 450;
      const y = layout.y - 1215;
      ctx.fillStyle = '#8d6041';
      roundedRect(x - 35, y - 28, 70, 56, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(x - 25, y - 18, 25, 3);
      if (plot.phase === 'seeded') {
        ellipse(x, y, 5, 5, '#f5c653');
      }
      if (plot.phase === 'growing' || plot.phase === 'ready') {
        ctx.strokeStyle = '#4e964c';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x, y - 10);
        ctx.stroke();
        ellipse(x - 8, y - 7, 8, 5, '#70b65a');
        ellipse(x + 8, y - 14, 8, 5, '#70b65a');
      }
      if (plot.phase === 'ready') {
        ellipse(x - 11, y - 22, 6, 6, '#8e5cab');
        ellipse(x + 5, y - 26, 6, 6, '#8e5cab');
        ellipse(x + 16, y - 16, 6, 6, '#8e5cab');
      }
      if (plot.watered) {
        ctx.fillStyle = '#64b8d2';
        ctx.beginPath();
        ctx.arc(x + 24, y + 12, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    label('Moonberry Garden', 585, 1194);
  }

  function drawStoryStone() {
    ctx.save();
    ctx.translate(landmark.x, landmark.y);
    ellipse(0, 36, 42, 11, 'rgba(45,99,54,.18)');
    ctx.fillStyle = '#6f7a96';
    roundedRect(-24, -38, 48, 72, 14);
    ctx.fill();
    ctx.fillStyle = '#d8b6e6';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e7dcf4';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    label('Old Story Stone', landmark.x, landmark.y - 57);
  }

  function drawDaylightOverlay() {
    const sun = Math.sin((state.clock - 6) / 24 * Math.PI * 2);
    const nightness = clamp(.52 - sun * .48, 0, .52);
    if (nightness < .03) return;
    ctx.save();
    ctx.fillStyle = 'rgba(25,39,83,' + nightness + ')';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.restore();
  }

  function drawWorld(time) {
    ctx.fillStyle = '#b7dc77';
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    ctx.fillStyle = '#d4ea89';
    ctx.fillRect(1030, 0, 860, worldHeight);
    ctx.fillStyle = '#c5e4b5';
    ctx.fillRect(1890, 0, worldWidth - 1890, 690);
    ctx.fillStyle = '#a9d78b';
    ctx.fillRect(1890, 690, worldWidth - 1890, worldHeight - 690);

    ctx.fillStyle = 'rgba(255,255,255,.19)';
    for (let x = 30; x < worldWidth; x += 64) {
      for (let y = 38; y < worldHeight; y += 57) {
        const wobble = (x * 13 + y * 7) % 19;
        ctx.fillRect(x + wobble, y + (wobble % 9), 2, 7);
      }
    }

    ctx.strokeStyle = '#e8c274';
    ctx.lineWidth = 115;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 1025);
    ctx.bezierCurveTo(700, 960, 900, 1320, 1390, 1060);
    ctx.bezierCurveTo(1770, 860, 1980, 730, 2320, 610);
    ctx.stroke();
    ctx.strokeStyle = '#f7dda0';
    ctx.lineWidth = 82;
    ctx.stroke();

    ctx.save();
    ctx.font = '800 36px Georgia, serif';
    ctx.fillStyle = 'rgba(23,60,55,.18)';
    ctx.fillText('BARNYARD', 135, 170);
    ctx.fillText('WILDFLOWER MEADOW', 1125, 170);
    ctx.fillText('HILLTOP VILLAGE', 1940, 150);
    ctx.fillText('HAPPY POND', 2010, 1770);
    ctx.restore();

    drawBarn(310, 215);
    drawCottage(105, 1165, '#edb875');
    drawCottage(1835, 202, '#df9d79');
    drawCottage(2370, 320, '#dbd291');
    drawWindmill(1350, 290);
    drawPond();
    drawGarden();
    drawStoryStone();

    const trees = [
      [92, 190, 1.15], [930, 200, .9], [950, 540, 1], [80, 840, .85], [990, 1500, 1.1],
      [1110, 390, .85], [1555, 220, 1.05], [1650, 1450, .9], [1830, 1640, 1], [1970, 520, .8],
      [2660, 250, 1.1], [2690, 720, 1], [1900, 1770, .9], [2670, 1770, 1.05], [2400, 1680, .8]
    ];
    trees.forEach(([x, y, scale]) => drawTree(x, y, scale));

    ctx.fillStyle = '#f4b755';
    for (let flower = 0; flower < 38; flower += 1) {
      const x = 1090 + (flower * 137) % 700;
      const y = 460 + (flower * 89) % 1120;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    items.forEach((item) => {
      if (state.taken.has(item.id)) return;
      const available = itemIsActive(item);
      if (!available) return;
      if (item.type === 'petal') drawPetal(item.x, item.y, time);
      else drawTreat(item.x, item.y, time);
    });

    npcs.forEach((npc) => {
      if (npc.type === 'farmer') drawFarmer(npc.x, npc.y);
      if (npc.type === 'frog') drawFrogNpc(npc.x, npc.y, 1);
      if (npc.type === 'bunny') drawBunny(npc.x, npc.y);
      if (npc.type === 'hen') drawHen(npc.x, npc.y);
      label(npc.name, npc.x, npc.y - 53);
    });

    if (state.companion) {
      drawFrogNpc(companion.x, companion.y, .75);
      label('Puddlehop', companion.x, companion.y - 43);
    }

    drawDog(player.x, player.y, 1.05, player.direction, true);
  }

  function drawHud() {
    ctx.save();
    ctx.fillStyle = 'rgba(14,47,44,.83)';
    roundedRect(18, 18, 260, 94, 15);
    ctx.fill();
    ctx.fillStyle = '#a9d48d';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillText('FROG THE TRAILBLAZER · LEVEL ' + trailblazerLevel(), 35, 43);
    ctx.fillStyle = '#fff';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText(zoneName(), 35, 68);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#f5c653';
    ctx.fillText('Friendship ' + state.friendship + '   Treats ' + state.treats + ' / 3', 35, 86);
    ctx.fillStyle = '#c9ddd8';
    ctx.fillText('Day ' + state.day + ' · ' + timeOfDay() + ' · Moonberries ' + state.moonberries, 35, 104);

    const mapX = logicalWidth - 150;
    const mapY = 18;
    const mapW = 130;
    const mapH = 90;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    roundedRect(mapX, mapY, mapW, mapH, 13);
    ctx.fill();
    ctx.fillStyle = '#b7dc77';
    roundedRect(mapX + 6, mapY + 6, mapW - 12, mapH - 12, 9);
    ctx.fill();
    ctx.fillStyle = '#67bfd6';
    ellipse(mapX + 106, mapY + 59, 17, 13, '#67bfd6');
    ctx.fillStyle = '#d9553f';
    ctx.fillRect(mapX + 21, mapY + 19, 15, 12);
    ctx.fillStyle = '#e8c274';
    ctx.fillRect(mapX + 13, mapY + 51, 101, 5);
    const px = mapX + 6 + (player.x / worldWidth) * (mapW - 12);
    const py = mapY + 6 + (player.y / worldHeight) * (mapH - 12);
    ellipse(px, py, 4, 4, '#173c37');
    ctx.restore();
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    words.forEach((word) => {
      const trial = line ? line + ' ' + word : word;
      if (ctx.measureText(trial).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = trial;
      }
    });
    if (line) ctx.fillText(line, x, currentY);
    return currentY;
  }

  function drawDialog() {
    const dialog = state.dialog;
    ctx.save();
    ctx.fillStyle = 'rgba(6,29,27,.57)';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = '#fffaf0';
    roundedRect(75, 385, 810, 160, 22);
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.font = '800 18px Georgia, serif';
    ctx.fillText(dialog.title, 108, 423);
    ctx.font = '500 17px system-ui, sans-serif';
    const endY = wrapText(dialog.message, 108, 454, 715, 24);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#377c49';
    ctx.fillText('Press E, Enter, or Talk to continue', 108, Math.min(endY + 35, 520));
    ctx.restore();
  }

  function drawStartScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,29,27,.52)';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = '#fffaf0';
    roundedRect(192, 164, 576, 270, 28);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#377c49';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText('A STORYBOOK OPEN-WORLD LIFE RPG', logicalWidth / 2, 218);
    ctx.fillStyle = '#173c37';
    ctx.font = '700 46px Georgia, serif';
    ctx.fillText('Frog’s Farmyard Quest', logicalWidth / 2, 278);
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillStyle = '#45635b';
    ctx.fillText('Explore, meet friends, grow Moonberries, and help the farm.', logicalWidth / 2, 323);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#377c49';
    ctx.fillText('Use Start Adventure below to begin.', logicalWidth / 2, 376);
    ctx.restore();
  }

  function drawMapOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,29,27,.74)';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    const x = 120;
    const y = 74;
    const w = 720;
    const h = 450;
    ctx.fillStyle = '#fffaf0';
    roundedRect(x, y, w, h, 24);
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.font = '700 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frog’s Farmyard Map', logicalWidth / 2, 120);
    const insetX = x + 38;
    const insetY = y + 78;
    const insetW = w - 76;
    const insetH = h - 130;
    ctx.fillStyle = '#b7dc77';
    roundedRect(insetX, insetY, insetW, insetH, 15);
    ctx.fill();
    ctx.fillStyle = '#d4ea89';
    ctx.fillRect(insetX + 225, insetY, 210, insetH);
    ctx.fillStyle = '#c5e4b5';
    ctx.fillRect(insetX + 435, insetY, insetW - 435, 110);
    ctx.fillStyle = '#a9d78b';
    ctx.fillRect(insetX + 435, insetY + 110, insetW - 435, insetH - 110);
    ctx.fillStyle = '#e8c274';
    ctx.fillRect(insetX, insetY + 163, insetW, 24);
    ctx.fillStyle = '#67bfd6';
    ellipse(insetX + 560, insetY + 226, 91, 66, '#67bfd6');
    ctx.fillStyle = '#d9553f';
    ctx.fillRect(insetX + 55, insetY + 48, 56, 40);
    ctx.fillStyle = '#efb776';
    ctx.fillRect(insetX + 468, insetY + 35, 52, 33);
    ctx.fillStyle = '#8d6041';
    ctx.fillRect(insetX + 76, insetY + 229, 50, 24);
    ctx.fillStyle = '#d8b6e6';
    ellipse(insetX + 358, insetY + 255, 10, 10, '#d8b6e6');
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillStyle = '#345650';
    ctx.fillText('Barnyard', insetX + 84, insetY + 132);
    ctx.fillText('Meadow', insetX + 334, insetY + 62);
    ctx.fillText('Village', insetX + 515, insetY + 105);
    ctx.fillText('Happy Pond', insetX + 560, insetY + 316);
    const px = insetX + (player.x / worldWidth) * insetW;
    const py = insetY + (player.y / worldHeight) * insetH;
    ellipse(px, py, 9, 9, '#173c37', '#fff');
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = '#377c49';
    ctx.fillText('Press M, Escape, or Map to return to the adventure.', logicalWidth / 2, 493);
    ctx.restore();
  }

  function drawJournalOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,29,27,.74)';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.fillStyle = '#fffaf0';
    roundedRect(105, 52, 750, 496, 24);
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.textAlign = 'center';
    ctx.font = '700 31px Georgia, serif';
    ctx.fillText('Frog’s Quest Journal', logicalWidth / 2, 102);
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillStyle = '#377c49';
    ctx.fillText('TRAILBLAZER LEVEL ' + trailblazerLevel() + ' · DAY ' + state.day + ' · ' + timeOfDay().toUpperCase(), logicalWidth / 2, 129);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#e5f0d9';
    roundedRect(138, 158, 446, 293, 16);
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText('MAIN ADVENTURE', 166, 190);
    ctx.font = '700 20px Georgia, serif';
    ctx.fillText('A Farmyard Trailblazer', 166, 220);
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = '#45635b';
    wrapText(currentQuest(), 166, 252, 375, 23);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#377c49';
    ctx.fillText((state.stage >= 3 ? '✓' : '○') + ' Make a friend at Happy Pond', 166, 345);
    ctx.fillText((state.stage >= 6 ? '✓' : '○') + ' Return Dad’s lost treats', 166, 378);
    ctx.fillText((state.loreFound ? '✓' : '○') + ' Discover the Old Story Stone', 166, 411);

    ctx.fillStyle = '#f7ead0';
    roundedRect(606, 158, 216, 293, 16);
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText('FARM & FRIENDS', 632, 190);
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('Moonberry Garden', 632, 224);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#45635b';
    ctx.fillText('Seeds: ' + state.seeds, 632, 255);
    ctx.fillText('Moonberries: ' + state.moonberries, 632, 281);
    ctx.fillText('Harvests: ' + state.harvests, 632, 307);
    ctx.fillStyle = '#173c37';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('Farm Friend', 632, 346);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#45635b';
    ctx.fillText(state.companion ? 'Puddlehop is helping.' : 'Keep exploring Happy Pond.', 632, 373);
    ctx.fillText('Friendship: ' + state.friendship, 632, 404);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#377c49';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('Press J, Escape, Interact, or Journal to return to the adventure.', logicalWidth / 2, 504);
    ctx.restore();
  }

  function drawInteractionHint() {
    if (!state.started || state.dialog || state.mapOpen || state.journalOpen) return;
    const npc = nearestNpc();
    const plot = nearestGardenPlot();
    let text = '';
    if (npc) text = 'Talk to ' + npc.name;
    else if (plot) text = 'Tend the Moonberry garden';
    else if (nearCottage()) text = 'Rest until tomorrow';
    else if (nearLandmark()) text = 'Read the Old Story Stone';
    if (!text) return;
    ctx.save();
    ctx.font = '800 15px system-ui, sans-serif';
    const width = ctx.measureText(text).width + 28;
    roundedRect(logicalWidth / 2 - width / 2, logicalHeight - 54, width, 35, 18);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.fillStyle = '#173c37';
    ctx.textAlign = 'center';
    ctx.fillText(text, logicalWidth / 2, logicalHeight - 31);
    ctx.restore();
  }

  function drawToast(time) {
    if (!state.toast) return;
    if (time > state.toast.until) {
      state.toast = null;
      return;
    }
    const remaining = clamp((state.toast.until - time) / 2600, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, remaining * 4);
    ctx.font = '800 14px system-ui, sans-serif';
    const width = ctx.measureText(state.toast.text).width + 34;
    roundedRect(logicalWidth / 2 - width / 2, 122, width, 38, 19);
    ctx.fillStyle = '#173c37';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast.text, logicalWidth / 2, 147);
    ctx.restore();
  }

  function render(time) {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawWorld(time);
    ctx.restore();
    drawDaylightOverlay();
    drawHud();
    drawInteractionHint();
    drawToast(time);
    if (!state.started) drawStartScreen();
    if (state.mapOpen) drawMapOverlay();
    else if (state.journalOpen) drawJournalOverlay();
    else if (state.dialog) drawDialog();
  }

  function loop(time) {
    const delta = Math.min((time - state.lastTime) / 1000 || 0, .05);
    state.lastTime = time;
    if (state.running && !state.dialog && !state.mapOpen && !state.journalOpen) {
      advanceClock(delta);
      updatePlayerMovement(time);
      updateCompanion(delta);
      collectItems();
      updateUi();
    }
    updateCamera();
    render(time);
    requestAnimationFrame(loop);
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = logicalWidth * ratio;
    canvas.height = logicalHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function setDirectionHeld(direction, active, source) {
    const input = source === 'keyboard' ? state.keys : state.touchKeys;
    if (active) {
      input.add(direction);
      requestTileMove(direction);
    } else {
      input.delete(direction);
    }
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const movementKeys = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    if (movementKeys[key]) {
      event.preventDefault();
      setDirectionHeld(movementKeys[key], true, 'keyboard');
    }
    if (!state.started) return;
    if (key === 'e' || key === 'enter' || key === ' ') {
      event.preventDefault();
      interact();
    }
    if (key === 'm') {
      event.preventDefault();
      state.mapOpen = !state.mapOpen;
      state.journalOpen = false;
      updateUi();
    }
    if (key === 'j') {
      event.preventDefault();
      state.journalOpen = !state.journalOpen;
      state.mapOpen = false;
      updateUi();
    }
    if (key === 'escape' && (state.dialog || state.mapOpen || state.journalOpen)) {
      state.dialog = null;
      state.mapOpen = false;
      state.journalOpen = false;
      updateUi();
    }
  });

  window.addEventListener('keyup', (event) => {
    const movementKeys = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    const direction = movementKeys[event.key.toLowerCase()];
    if (direction) setDirectionHeld(direction, false, 'keyboard');
  });

  document.querySelectorAll('[data-game-control]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      beginAdventure();
      setDirectionHeld(button.dataset.gameControl, true, 'touch');
      button.setPointerCapture(event.pointerId);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => {
      button.addEventListener(name, () => setDirectionHeld(button.dataset.gameControl, false, 'touch'));
    });
  });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    if (state.dialog) interact();
  });

  dom.start.addEventListener('click', beginAdventure);
  dom.interact.addEventListener('click', interact);
  dom.map.addEventListener('click', () => {
    if (!state.started) beginAdventure();
    state.mapOpen = !state.mapOpen;
    state.journalOpen = false;
    updateUi();
  });
  dom.journal.addEventListener('click', () => {
    if (!state.started) beginAdventure();
    state.journalOpen = !state.journalOpen;
    state.mapOpen = false;
    updateUi();
  });
  dom.reset.addEventListener('click', resetAdventure);
  window.addEventListener('resize', resize);

  loadProgress();
  resize();
  updateUi();
  updateCamera();
  requestAnimationFrame(loop);
})();
