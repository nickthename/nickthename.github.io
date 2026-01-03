(async function () {
      const app = window.CalcApp || {};
      const config = app.config || {};
      const UI_TEXT = app.UI_TEXT || {};
      const PAGE_LANGUAGE = app.PAGE_LANGUAGE || config.pageLanguage || 'en';
      const LANGUAGE_PATHS = app.LANGUAGE_PATHS || config.languagePaths || { en: '/calc/', ja: '/ja/calc/' };
      const LOCAL_STORAGE_LANGUAGE_KEY = app.LOCAL_STORAGE_LANGUAGE_KEY || config.localStorageLanguageKey || 'smash64:lang';
      const CHARACTER_ICONS = app.CHARACTER_ICONS || config.characterIcons || {};
      const MOVESET_FILES = app.MOVESET_FILES || config.movesetFiles || { U: '/calc/movesets.json', J: '/calc/j_movesets.json' };
      const MOVE_LABELS_FILE = app.MOVE_LABELS_FILE || config.moveLabelFile || '/calc/move-labels.json';

      const {
        elements = {},
        outputNodes = {},
        constants = {},
        trajectoryElements = {},
        trajectoryState = {},
      } = app;

      const {
        form,
        defenderSelect,
        attackerSelect,
        moveSelect,
        moveDetails,
        weightInput,
        fallAccelInput,
        maxFallInput,
        hpInput,
        damageInput,
        angleInput,
        kbsInput,
        bkbInput,
        fkbInput,
        stalenessButtons,
        cameraButtons,
        electricToggle,
        throwToggle,
        targetStateSelect,
        attackDirectionButtons,
        simulationSelect,
        comboDelayInput,
        comboDelayRow,
        attackHandicapInput,
        defenseHandicapInput,
        positionHorizontalSelect,
        positionVerticalSelect,
        positionXInput,
        positionYInput,
        debugToggle,
        snapToggle,
        doubleJumpArmorRow,
        doubleJumpArmorToggle,
        languageSelect,
        versionSelect,
        versionSelectorRoot,
        copyLinkButton,
        resetButton,
        backgroundSelector,
        backgroundToggle,
        backgroundMenu,
        backgroundOptions,
      } = elements;

      const {
        BLASTZONE_LIMITS = { left: -9000, right: 9000, bottom: -3500, top: 8300 },
        POSITION_DATA = {
          stage: { y: 0, center: 0, halfWidth: 2318 },
          'left-platform': { y: 904, center: -1396, halfWidth: 445 },
          'right-platform': { y: 907, center: 1421.5, halfWidth: 470.5 },
          'top-platform': { y: 1542, center: 0, halfWidth: 570 },
        },
        DOUBLE_JUMP_ARMOR_LIFT = 160,
      } = constants;
      const SHIELD_HEALTH_MAX = 55;

      const state = app.state || (app.state = {});
      state.suppressCustomPositionInput = state.suppressCustomPositionInput ?? false;
      state.stalenessValue = state.stalenessValue ?? 'fresh';
      state.customPosition = state.customPosition ?? null;
      state.autoAirborneActive = state.autoAirborneActive ?? false;
      state.lastGroundState = state.lastGroundState ?? (targetStateSelect && targetStateSelect.value ? targetStateSelect.value : 'standing');
      state.doubleJumpArmorLiftActive = state.doubleJumpArmorLiftActive ?? false;
      state.doubleJumpArmorAnchor = state.doubleJumpArmorAnchor ?? null;
      state.suppressPositionChange = state.suppressPositionChange ?? false;
      state.attackDirection = state.attackDirection ?? 'right';
      state.selectedMoveShieldDamage = state.selectedMoveShieldDamage ?? 0;

      const {
        isPositionOnPlatform,
        setCustomPositionDirect,
        setPositionFromStageCoords,
        updateTrajectoryDisplay,
        handleTrajectoryPointerDown,
        handleTrajectoryPointerMove,
        handleTrajectoryPointerUp,
        applyTrajectoryViewBox,
        renderStageGeometry,
      } = app;

      const getCharacterOptionMarkup = (character) => {
        const iconPath = CHARACTER_ICONS[character.key];
        if (!iconPath) return null;
        return `<img src="${iconPath}" alt="" role="presentation">${character.name}`;
      };

      const setSelectValue = (dropdown, select, value, { triggerChange = false } = {}) => {
        if (value === undefined || value === null) return;
        select.value = value;

        if (dropdown && typeof dropdown.set === 'function') {
          dropdown.set(value, triggerChange);
          return;
        }
        if (dropdown && typeof dropdown.setSelected === 'function') {
          dropdown.setSelected(value);
        }

        if (triggerChange) {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      let defenderDropdown = null;
      let attackerDropdown = null;

      function computePosition(horizontalKey, verticalKey) {
        const platform = POSITION_DATA[verticalKey] || POSITION_DATA.stage;
        let x = platform.center;
        if (horizontalKey === 'left') {
          x = platform.center - platform.halfWidth;
        } else if (horizontalKey === 'right') {
          x = platform.center + platform.halfWidth;
        }
        return { x, y: platform.y };
      }

      app.computePosition = computePosition;

      function isYoshiDefender() {
        return defenderSelect.value === 'Yoshi';
      }

      function getActiveStagePosition() {
        if (state.customPosition !== null) {
          return { x: state.customPosition.x, y: state.customPosition.y };
        }
        return computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
      }

      function formatPositionInputValue(value) {
        if (!Number.isFinite(value)) {
          return '';
        }
        const rounded = Number(value.toFixed(1));
        if (!Number.isFinite(rounded)) {
          return String(value);
        }
        if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
          return String(Math.round(rounded));
        }
        return rounded.toFixed(1);
      }

      function syncPositionInputs() {
        if (!positionXInput || !positionYInput) return;
        const active = getActiveStagePosition();
        state.suppressCustomPositionInput = true;
        positionXInput.value = formatPositionInputValue(active.x);
        positionYInput.value = formatPositionInputValue(active.y);
        state.suppressCustomPositionInput = false;
      }

      app.syncPositionInputs = syncPositionInputs;
      let doubleJumpArmorThreshold = (Smash64Calculator.doubleJumpArmorValue || 140);

      function enforceDoubleJumpArmorState({ skipCalculate = false, forceCalculate = false } = {}) {
        const yoshiSelected = isYoshiDefender();
        const armorEnabled = yoshiSelected && doubleJumpArmorToggle && doubleJumpArmorToggle.checked;
        let changed = false;

        if (!yoshiSelected) {
          if (doubleJumpArmorToggle && doubleJumpArmorToggle.checked) {
            doubleJumpArmorToggle.checked = false;
            changed = true;
          }
          if (state.doubleJumpArmorLiftActive) {
            state.doubleJumpArmorLiftActive = false;
            state.customPosition = null;
            changed = true;
          }
          state.autoAirborneActive = false;
          if (!skipCalculate && (changed || forceCalculate)) {
            calculate();
          }
          return;
        }

        if (armorEnabled) {
          if (targetStateSelect.value !== 'airborne') {
            if (targetStateSelect.value && targetStateSelect.value !== 'airborne') {
              state.lastGroundState = targetStateSelect.value;
            }
            targetStateSelect.value = 'airborne';
            changed = true;
          }

          const dropdownPosition = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
          const activePosition = state.customPosition ?? dropdownPosition;
          const onPlatform = isPositionOnPlatform(activePosition);
          if (onPlatform) {
            const liftedY = activePosition.y + DOUBLE_JUMP_ARMOR_LIFT;
            const currentCustom = state.customPosition;
            const needsLift = !currentCustom || !state.doubleJumpArmorLiftActive
              || Math.abs(currentCustom.x - activePosition.x) > 0.5
              || Math.abs(currentCustom.y - liftedY) > 0.5;
            if (needsLift) {
              setCustomPositionDirect(activePosition.x, liftedY);
              state.doubleJumpArmorLiftActive = true;
              state.doubleJumpArmorAnchor = { x: activePosition.x, y: activePosition.y };
              changed = true;
            }
          } else {
            state.doubleJumpArmorLiftActive = false;
            state.doubleJumpArmorAnchor = null;
          }
          state.autoAirborneActive = true;
        } else {
          state.autoAirborneActive = false;
          if (state.doubleJumpArmorLiftActive) {
            state.doubleJumpArmorLiftActive = false;
            if (state.doubleJumpArmorAnchor) {
              setCustomPositionDirect(state.doubleJumpArmorAnchor.x, state.doubleJumpArmorAnchor.y);
            } else {
              state.customPosition = null;
              syncPositionInputs();
            }
            state.doubleJumpArmorAnchor = null;
            changed = true;
          }
          const fallback = (state.lastGroundState && state.lastGroundState !== 'airborne') ? state.lastGroundState : 'standing';
          if (targetStateSelect.value !== fallback) {
            targetStateSelect.value = fallback;
            changed = true;
          }
        }

        if (!skipCalculate && (changed || forceCalculate)) {
          calculate();
        }
      }

      function updateDoubleJumpArmorVisibility({ skipCalculate = false } = {}) {
        const yoshiSelected = isYoshiDefender();
        if (doubleJumpArmorRow) {
          doubleJumpArmorRow.classList.toggle('hidden', !yoshiSelected);
        }
        enforceDoubleJumpArmorState({ skipCalculate, forceCalculate: false });
      }

      function updateStalenessButtons() {
        stalenessButtons.forEach((button) => {
          const isActive = button.dataset.staleness === state.stalenessValue;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }

      function setStaleness(value, { trigger = true } = {}) {
        if (!value) return;
        const changed = state.stalenessValue !== value;
        state.stalenessValue = value;
        updateStalenessButtons();
        if (trigger && changed) calculate();
      }

      function updateAttackDirectionButtons() {
        if (!Array.isArray(attackDirectionButtons)) return;
        attackDirectionButtons.forEach((button) => {
          const isActive = button.dataset.attackDirection === state.attackDirection;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }

      function setAttackDirection(value, { trigger = true } = {}) {
        const normalized = ATTACK_DIRECTION_ORDER.includes(value) ? value : ATTACK_DIRECTION_ORDER[0];
        const changed = state.attackDirection !== normalized;
        state.attackDirection = normalized;
        updateAttackDirectionButtons();
        if (trigger && changed) calculate();
      }

      function updateCameraButtons() {
        cameraButtons.forEach((button) => {
          const isActive = button.dataset.cameraMode === trajectoryState.cameraMode;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }

      function setCameraMode(mode, { trigger = true } = {}) {
        if (!mode) return;
        const normalized = (mode === 'stage' || mode === 'blastzone') ? mode : 'fit';
        const changed = trajectoryState.cameraMode !== normalized;
        trajectoryState.cameraMode = normalized;
        updateCameraButtons();
        if (changed && trigger) {
          calculate();
        }
      }

      const numericValue = (input, fallback = 0) => {
        const value = Number(input.value);
        return Number.isFinite(value) ? value : fallback;
      };
      const updateComboDelayVisibility = () => {
        if (!comboDelayRow) return;
        comboDelayRow.classList.toggle('hidden', simulationSelect.value !== 'custom');
      };

      let debugMode = false;
      const baseDecimals = 1;
      const debugDecimals = 6;
      const roundingEpsilon = 1e-6;

      const roundToDecimal = (value, decimals = baseDecimals) => {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor + Number.EPSILON) / factor;
      };

      const formatStandard = (value, decimals = baseDecimals) => {
        if (!Number.isFinite(value)) return '—';
        if (debugMode) return value.toFixed(debugDecimals);
        return roundToDecimal(value, decimals).toFixed(decimals);
      };

      const formatIntegral = (value) => {
        if (!Number.isFinite(value)) return '—';
        if (debugMode && Math.abs(value - Math.round(value)) > roundingEpsilon) {
          return value.toFixed(debugDecimals);
        }
        if (Math.abs(value - Math.round(value)) < roundingEpsilon) {
          return String(Math.round(value));
        }
        return roundToDecimal(value, 1).toFixed(1);
      };

      const formatPercent = (value) => `${formatIntegral(value)}%`;

      const setHintedValue = (node, valueText, hintText) => {
        if (!node) return;
        node.textContent = '';
        const span = document.createElement('span');
        span.className = 'hint-underline';
        span.textContent = valueText;
        span.title = hintText;
        node.append(span);
      };
      function isKill(x, y) {
        return y >= BLASTZONE_LIMITS.top
          || y <= BLASTZONE_LIMITS.bottom
          || x <= BLASTZONE_LIMITS.left
          || x >= BLASTZONE_LIMITS.right;
      }

      app.isKill = isKill;

      let movesets = {};
      let currentMoves = [];
      let selectedMoveIndex = null;
      let selectedMoveData = null;
      let customOption = null;
      let suppressCustomFlag = false;
      let defenderCustomOption = null;
      let selectedDefenderData = null;
      let selectedDefenderTraction = null;
      let suppressDefenderCustom = false;
      let lastMoveBaseName = null;

      const normalizeLanguage = (value) => (String(value || '').toLowerCase() === 'ja' ? 'ja' : 'en');
      const VERSION_BY_LANGUAGE = { en: 'U', ja: 'J' };
      const movesetCache = {};
      let currentVersion = 'U';
      let currentLanguage = normalizeLanguage(PAGE_LANGUAGE);
      let moveLabelMap = null;
      const MOVE_GROUP_ORDER = ['aerial', 'tilt', 'smash', 'special', 'throw', 'other'];

      const normalizeVersion = (value) => (String(value || '').toUpperCase() === 'J' ? 'J' : 'U');
      const normalizeMoveKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

      const loadMoveLabels = async () => {
        if (moveLabelMap) return moveLabelMap;
        try {
          const response = await fetch(MOVE_LABELS_FILE);
          if (response.ok) {
            moveLabelMap = await response.json();
          } else {
            console.error(`Failed to load ${MOVE_LABELS_FILE}`, response.status);
          }
        } catch (error) {
          console.error(`Unable to load ${MOVE_LABELS_FILE}`, error);
        }
        if (!moveLabelMap || typeof moveLabelMap !== 'object') {
          moveLabelMap = { moves: {} };
        }
        if (!moveLabelMap.moves || typeof moveLabelMap.moves !== 'object') {
          moveLabelMap.moves = {};
        }
        return moveLabelMap;
      };

      const getMoveLabelEntry = (move) => {
        if (!moveLabelMap || !moveLabelMap.moves) return null;
        const baseName = move.baseName || move.name || '';
        const key = normalizeMoveKey(baseName);
        return moveLabelMap.moves[key] || null;
      };

      const getMoveLabel = (move) => {
        const baseName = move.baseName || move.name || '';
        const entry = getMoveLabelEntry(move);
        if (currentLanguage === 'ja' && entry && entry.ja) {
          return entry.ja;
        }
        return move.name || baseName || '';
      };

      const getMoveGroup = (move) => {
        const entry = getMoveLabelEntry(move);
        return entry && entry.group ? entry.group : 'other';
      };

      const getMoveGroupLabel = (group) => {
        const labels = UI_TEXT.moveGroups || {};
        return labels[group] || group;
      };

      const STALENESS_ORDER = ['fresh', 'lv3', 'lv2', 'lv1', 'stale'];
      const TARGET_STATE_ORDER = ['standing', 'crouching', 'airborne', 'laying'];
      const SIMULATION_ORDER = ['hitstun', 'velocity', 'custom'];
      const ATTACK_DIRECTION_ORDER = ['right', 'left'];
      const CAMERA_MODE_ORDER = ['fit', 'stage', 'blastzone'];
      const POSITION_HORIZONTAL_ORDER = ['left', 'center', 'right'];
      const POSITION_VERTICAL_ORDER = ['stage', 'left-platform', 'right-platform', 'top-platform'];
      const CHARACTER_CUSTOM_CODE = 15;
      const SCALE_COORD = 10;
      const SCALE_STATS = 100;
      const SCALE_DAMAGE = 10;

      const encodeBytes = (bytes) => {
        try {
          let binary = '';
          bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
          });
          return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        } catch (error) {
          console.error('Failed to encode state', error);
          return null;
        }
      };

      const decodeBytes = (encoded) => {
        try {
          const base64 = `${encoded}`.replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
          const binary = atob(padded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        } catch (error) {
          console.error('Failed to decode state', error);
          return null;
        }
      };

      class ByteWriter {
        constructor() {
          this.bytes = [];
        }

        writeByte(value) {
          this.bytes.push(value & 0xff);
        }

        writeVarint(value) {
          let remaining = Math.max(0, Math.trunc(value));
          while (remaining > 0x7f) {
            this.writeByte((remaining & 0x7f) | 0x80);
            remaining = Math.floor(remaining / 128);
          }
          this.writeByte(remaining);
        }

        writeZigZag(value) {
          const scaled = Math.trunc(value);
          const zigzag = scaled < 0 ? (-scaled * 2 - 1) : (scaled * 2);
          this.writeVarint(zigzag);
        }
      }

      class ByteReader {
        constructor(bytes) {
          this.bytes = bytes || [];
          this.offset = 0;
        }

        readByte() {
          if (this.offset >= this.bytes.length) return null;
          const value = this.bytes[this.offset];
          this.offset += 1;
          return value;
        }

        readVarint() {
          let result = 0;
          let shift = 0;
          let byte = 0;
          do {
            byte = this.readByte();
            if (byte === null) return null;
            result |= (byte & 0x7f) << shift;
            shift += 7;
          } while (byte & 0x80);
          return result;
        }

        readZigZag() {
          const value = this.readVarint();
          if (value === null) return null;
          return (value & 1) ? -((value + 1) / 2) : (value / 2);
        }
      }

      const getCharacterIndex = (key) => {
        if (!key) return CHARACTER_CUSTOM_CODE;
        const index = Smash64Calculator.characters.findIndex((entry) => entry.key === key);
        return index >= 0 ? index : CHARACTER_CUSTOM_CODE;
      };

      const getCharacterKey = (index) => {
        const list = Smash64Calculator.characters;
        if (Number.isFinite(index) && index >= 0 && index < list.length) {
          return list[index].key;
        }
        return '__custom__';
      };

      const findIndexInList = (value, list, fallback = 0) => {
        if (value === null || value === undefined) return fallback;
        const idx = list.indexOf(value);
        return idx >= 0 ? idx : fallback;
      };

      const encodePosition = (position, writer) => {
        const pos = position || {};
        let mask = 0;
        if (typeof pos.custom === 'boolean') mask |= 1;
        if (pos.horizontal !== undefined) mask |= 2;
        if (pos.vertical !== undefined) mask |= 4;
        if (typeof pos.x === 'number') mask |= 8;
        if (typeof pos.y === 'number') mask |= 16;
        writer.writeVarint(mask);
        if (mask & 1) writer.writeVarint(pos.custom ? 1 : 0);
        if (mask & 2) writer.writeVarint(findIndexInList(pos.horizontal, POSITION_HORIZONTAL_ORDER));
        if (mask & 4) writer.writeVarint(findIndexInList(pos.vertical, POSITION_VERTICAL_ORDER));
        if (mask & 8) writer.writeZigZag(Math.round(pos.x * SCALE_COORD));
        if (mask & 16) writer.writeZigZag(Math.round(pos.y * SCALE_COORD));
      };

      const decodePosition = (reader) => {
        const mask = reader.readVarint();
        if (mask === null) return null;
        const position = {};
        if (mask & 1) {
          position.custom = reader.readVarint() === 1;
        }
        if (mask & 2) {
          const idx = reader.readVarint();
          position.horizontal = POSITION_HORIZONTAL_ORDER[idx] || POSITION_HORIZONTAL_ORDER[0];
        }
        if (mask & 4) {
          const idx = reader.readVarint();
          position.vertical = POSITION_VERTICAL_ORDER[idx] || POSITION_VERTICAL_ORDER[0];
        }
        if (mask & 8) {
          const value = reader.readZigZag();
          if (value !== null) position.x = value / SCALE_COORD;
        }
        if (mask & 16) {
          const value = reader.readZigZag();
          if (value !== null) position.y = value / SCALE_COORD;
        }
        return position;
      };

      const STATE_FIELDS = [
        {
          key: 'version',
          write: (value, writer) => writer.writeVarint(value === 'J' ? 1 : 0),
          read: (reader) => (reader.readVarint() === 1 ? 'J' : 'U'),
        },
        {
          key: 'defender',
          write: (value, writer) => writer.writeVarint(getCharacterIndex(value)),
          read: (reader) => getCharacterKey(reader.readVarint()),
        },
        {
          key: 'attacker',
          write: (value, writer) => writer.writeVarint(getCharacterIndex(value)),
          read: (reader) => getCharacterKey(reader.readVarint()),
        },
        {
          key: 'moveSlot',
          write: (value, writer) => writer.writeVarint(Math.max(0, Math.trunc(value))),
          read: (reader) => reader.readVarint(),
        },
        {
          key: 'staleness',
          write: (value, writer) => writer.writeVarint(findIndexInList(value, STALENESS_ORDER)),
          read: (reader) => STALENESS_ORDER[reader.readVarint()] || STALENESS_ORDER[0],
        },
        {
          key: 'targetState',
          write: (value, writer) => writer.writeVarint(findIndexInList(value, TARGET_STATE_ORDER)),
          read: (reader) => TARGET_STATE_ORDER[reader.readVarint()] || TARGET_STATE_ORDER[0],
        },
        {
          key: 'simulation',
          write: (value, writer) => writer.writeVarint(findIndexInList(value, SIMULATION_ORDER)),
          read: (reader) => SIMULATION_ORDER[reader.readVarint()] || SIMULATION_ORDER[0],
        },
        {
          key: 'attackDirection',
          write: (value, writer) => writer.writeVarint(findIndexInList(value, ATTACK_DIRECTION_ORDER)),
          read: (reader) => ATTACK_DIRECTION_ORDER[reader.readVarint()] || ATTACK_DIRECTION_ORDER[0],
        },
        { key: 'comboDelay', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'attackHandicap', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'defenseHandicap', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'damage', write: (value, writer) => writer.writeVarint(Math.round(value * SCALE_DAMAGE)), read: (reader) => reader.readVarint() / SCALE_DAMAGE },
        { key: 'angle', write: (value, writer) => writer.writeZigZag(value), read: (reader) => reader.readZigZag() },
        { key: 'kbs', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'bkb', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'fkb', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'electric', write: (value, writer) => writer.writeVarint(value ? 1 : 0), read: (reader) => reader.readVarint() === 1 },
        { key: 'throwMove', write: (value, writer) => writer.writeVarint(value ? 1 : 0), read: (reader) => reader.readVarint() === 1 },
        { key: 'hp', write: (value, writer) => writer.writeVarint(value), read: (reader) => reader.readVarint() },
        { key: 'weight', write: (value, writer) => writer.writeVarint(Math.round(value * SCALE_STATS)), read: (reader) => reader.readVarint() / SCALE_STATS },
        { key: 'fallAccel', write: (value, writer) => writer.writeVarint(Math.round(value * SCALE_STATS)), read: (reader) => reader.readVarint() / SCALE_STATS },
        { key: 'maxFall', write: (value, writer) => writer.writeVarint(Math.round(value * SCALE_STATS)), read: (reader) => reader.readVarint() / SCALE_STATS },
        { key: 'doubleJumpArmor', write: (value, writer) => writer.writeVarint(value ? 1 : 0), read: (reader) => reader.readVarint() === 1 },
        { key: 'position', write: (value, writer) => encodePosition(value, writer), read: (reader) => decodePosition(reader) },
        { key: 'snap', write: (value, writer) => writer.writeVarint(value ? 1 : 0), read: (reader) => reader.readVarint() === 1 },
        {
          key: 'cameraMode',
          write: (value, writer) => writer.writeVarint(findIndexInList(value, CAMERA_MODE_ORDER)),
          read: (reader) => CAMERA_MODE_ORDER[reader.readVarint()] || CAMERA_MODE_ORDER[0],
        },
        { key: 'debug', write: (value, writer) => writer.writeVarint(value ? 1 : 0), read: (reader) => reader.readVarint() === 1 },
      ];

      const encodeState = (state) => {
        if (!state) return null;
        const writer = new ByteWriter();
        let mask = 0;
        STATE_FIELDS.forEach((field, index) => {
          if (state[field.key] !== undefined) {
            mask |= (1 << index);
          }
        });
        writer.writeVarint(mask);
        STATE_FIELDS.forEach((field, index) => {
          if (mask & (1 << index)) {
            field.write(state[field.key], writer);
          }
        });
        return encodeBytes(writer.bytes);
      };

      const decodeState = (encoded) => {
        const bytes = decodeBytes(encoded);
        if (!bytes) return null;
        try {
          const reader = new ByteReader(bytes);
          const mask = reader.readVarint();
          if (mask === null) return null;
          const state = {};
          STATE_FIELDS.forEach((field, index) => {
            if (mask & (1 << index)) {
              const value = field.read(reader);
              if (value !== null && value !== undefined) {
                state[field.key] = value;
              }
            }
          });
          return state;
        } catch (error) {
          console.error('Failed to decode state', error);
          return null;
        }
      };

      const readNumber = (input) => {
        if (!input) return null;
        const value = Number(input.value);
        return Number.isFinite(value) ? value : null;
      };

      const readSelectValue = (select) => {
        if (!select) return null;
        const value = select.value;
        return value !== '' ? value : null;
      };

      let suppressUrlSync = true;
      let stateDirty = false;
      let pendingUrlUpdate = null;
      let hadDataParam = false;
      let initialDataState = null;
      let baselineState = null;
      let languageNavigationReady = false;

      const buildStateSnapshot = () => {
        const selectedMoveSlot = (moveSelect && moveSelect.value !== '')
          ? Math.max(0, Math.trunc(Number(moveSelect.value)))
          : null;
        const snapshot = {
          version: currentVersion,
          defender: readSelectValue(defenderSelect),
          attacker: readSelectValue(attackerSelect),
          moveSlot: Number.isFinite(selectedMoveSlot) ? selectedMoveSlot : null,
          staleness: state.stalenessValue,
          targetState: readSelectValue(targetStateSelect),
          attackDirection: state.attackDirection,
          simulation: readSelectValue(simulationSelect),
          attackHandicap: readNumber(attackHandicapInput),
          defenseHandicap: readNumber(defenseHandicapInput),
          hp: readNumber(hpInput),
          doubleJumpArmor: Boolean(doubleJumpArmorToggle && doubleJumpArmorToggle.checked),
          position: {
            custom: state.customPosition !== null,
            horizontal: readSelectValue(positionHorizontalSelect),
            vertical: readSelectValue(positionVerticalSelect),
            x: readNumber(positionXInput),
            y: readNumber(positionYInput),
          },
          snap: Boolean(snapToggle && snapToggle.checked),
          cameraMode: trajectoryState.cameraMode,
          debug: Boolean(debugToggle && debugToggle.checked),
        };

        if (simulationSelect && simulationSelect.value === 'custom') {
          snapshot.comboDelay = readNumber(comboDelayInput);
        }

        const moveOverridesActive = (moveSelect ? moveSelect.value === '' : false) || hasMoveOverride();
        if (moveOverridesActive) {
          snapshot.damage = readNumber(damageInput);
          snapshot.angle = readNumber(angleInput);
          snapshot.kbs = readNumber(kbsInput);
          snapshot.bkb = readNumber(bkbInput);
          snapshot.fkb = readNumber(fkbInput);
          snapshot.electric = Boolean(electricToggle && electricToggle.checked);
          snapshot.throwMove = Boolean(throwToggle && throwToggle.checked);
        }

        const defenderOverridesActive = (defenderCustomOption && defenderSelect.value === defenderCustomOption.value) || hasDefenderOverride();
        if (defenderOverridesActive) {
          snapshot.weight = readNumber(weightInput);
          snapshot.fallAccel = readNumber(fallAccelInput);
          snapshot.maxFall = readNumber(maxFallInput);
        }

        return snapshot;
      };

      const isEqualValue = (a, b) => (a === b) || (Number.isNaN(a) && Number.isNaN(b));

      const buildStateDelta = (current, base) => {
        if (!base) {
          return { ...current };
        }
        const delta = {};
        const keys = [
          'version', 'defender', 'attacker', 'moveSlot',
          'staleness', 'targetState', 'simulation', 'attackDirection', 'comboDelay',
          'attackHandicap', 'defenseHandicap',
          'damage', 'angle', 'kbs', 'bkb', 'fkb',
          'electric', 'throwMove',
          'hp', 'weight', 'fallAccel', 'maxFall',
          'doubleJumpArmor', 'snap', 'cameraMode', 'debug',
        ];
        keys.forEach((key) => {
          if (!isEqualValue(current[key], base[key])) {
            delta[key] = current[key];
          }
        });

        const basePos = base.position || {};
        const currentPos = current.position || {};
        const posDelta = {};
        const customChanged = !isEqualValue(currentPos.custom, basePos.custom);

        if (currentPos.custom) {
          if (customChanged) posDelta.custom = true;
          posDelta.x = currentPos.x;
          posDelta.y = currentPos.y;
        } else {
          if (customChanged) posDelta.custom = false;
          if (customChanged || !isEqualValue(currentPos.horizontal, basePos.horizontal)) {
            posDelta.horizontal = currentPos.horizontal;
          }
          if (customChanged || !isEqualValue(currentPos.vertical, basePos.vertical)) {
            posDelta.vertical = currentPos.vertical;
          }
        }

        if (Object.keys(posDelta).length > 0) {
          delta.position = posDelta;
        }

        if (Object.keys(delta).length === 0) {
          return null;
        }
        return delta;
      };

      const expandStateFromDelta = (base, delta) => {
        if (!delta || typeof delta !== 'object') return null;
        if (!base || typeof base !== 'object') {
          return { ...delta };
        }
        const merged = { ...base, ...delta };
        if (base.position || delta.position) {
          merged.position = { ...(base.position || {}), ...(delta.position || {}) };
        }
        return merged;
      };

      const updateUrlFromState = () => {
        if (suppressUrlSync) return;
        const url = new URL(window.location.href);
        const snapshot = buildStateSnapshot();
        const delta = buildStateDelta(snapshot, baselineState);
        if (delta) {
          const encoded = encodeState(delta);
          if (encoded) {
            url.searchParams.set('data', encoded);
          } else {
            url.searchParams.delete('data');
          }
        } else {
          url.searchParams.delete('data');
        }
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      };

      const BACKGROUND_STORAGE_KEY = 'smash64:calc-bg';
      const BACKGROUND_OPTIONS = ['full', 'faded', 'none'];

      const setBackgroundMode = (mode, { save = true } = {}) => {
        const normalized = BACKGROUND_OPTIONS.includes(mode) ? mode : 'full';
        if (trajectoryElements && trajectoryElements.svg) {
          trajectoryElements.svg.dataset.bg = normalized;
        }
        if (Array.isArray(backgroundOptions)) {
          backgroundOptions.forEach((option) => {
            const isActive = option.dataset.bgOption === normalized;
            option.classList.toggle('is-active', isActive);
            option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          });
        }
        if (save && window.localStorage) {
          window.localStorage.setItem(BACKGROUND_STORAGE_KEY, normalized);
        }
      };

      const toggleBackgroundMenu = (forceOpen = null) => {
        if (!backgroundSelector || !backgroundToggle) return;
        const isOpen = backgroundSelector.classList.contains('is-open');
        const nextOpen = forceOpen === null ? !isOpen : forceOpen;
        backgroundSelector.classList.toggle('is-open', nextOpen);
        backgroundToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      };

      let copyFeedbackTimer = null;
      const resetCopyButtonLabel = () => {
        if (!copyLinkButton) return;
        if (copyFeedbackTimer) {
          window.clearTimeout(copyFeedbackTimer);
          copyFeedbackTimer = null;
        }
        const baseLabel = copyLinkButton.dataset.copyLabel || copyLinkButton.dataset.label || copyLinkButton.textContent;
        if (baseLabel) {
          copyLinkButton.textContent = baseLabel;
        }
      };

      const showCopyFeedback = () => {
        if (!copyLinkButton) return;
        const copiedLabel = copyLinkButton.dataset.copiedLabel;
        if (!copiedLabel) return;
        resetCopyButtonLabel();
        copyLinkButton.textContent = copiedLabel;
        copyFeedbackTimer = window.setTimeout(() => {
          resetCopyButtonLabel();
        }, 1600);
      };

      const copyCurrentLink = async () => {
        updateUrlFromState();
        const url = window.location.href;
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
          } catch (error) {
            copied = false;
          }
        }
        if (!copied) {
          const promptLabel = (copyLinkButton && copyLinkButton.dataset.copyPrompt)
            ? copyLinkButton.dataset.copyPrompt
            : 'Copy this link:';
          window.prompt(promptLabel, url);
        }
        showCopyFeedback();
      };

      const resetToDefaults = async () => {
        if (!baselineState) return;
        await applyStateSnapshot(baselineState);
        updateUrlFromState();
        resetCopyButtonLabel();
      };

      const scheduleUrlUpdate = () => {
        if (suppressUrlSync) return;
        if (pendingUrlUpdate) {
          window.clearTimeout(pendingUrlUpdate);
        }
        pendingUrlUpdate = window.setTimeout(() => {
          pendingUrlUpdate = null;
          updateUrlFromState();
        }, 150);
      };

      const markStateDirty = () => {
        if (suppressUrlSync) return;
        stateDirty = true;
        scheduleUrlUpdate();
      };
      app.markStateDirty = markStateDirty;

      const navigateToLanguage = (language, { replace = false } = {}) => {
        const normalized = normalizeLanguage(language);
        const targetPath = LANGUAGE_PATHS[normalized] || LANGUAGE_PATHS.en;
        const url = new URL(targetPath, window.location.origin);
        const snapshot = buildStateSnapshot();
        const delta = buildStateDelta(snapshot, baselineState);
        if (delta) {
          const encoded = encodeState(delta);
          if (encoded) {
            url.searchParams.set('data', encoded);
          } else {
            url.searchParams.delete('data');
          }
        } else {
          url.searchParams.delete('data');
        }
        if (replace) {
          window.location.replace(url.toString());
        } else {
          window.location.assign(url.toString());
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      const langParam = urlParams.get('lang');
      hadDataParam = Boolean(dataParam);
      if (dataParam) {
        initialDataState = decodeState(dataParam);
      }

      const normalizedLangParam = langParam ? normalizeLanguage(langParam) : null;
      if (normalizedLangParam && normalizedLangParam !== currentLanguage) {
        const targetPath = LANGUAGE_PATHS[normalizedLangParam] || LANGUAGE_PATHS.en;
        const url = new URL(targetPath, window.location.origin);
        if (dataParam) {
          url.searchParams.set('data', dataParam);
        }
        window.location.replace(url.toString());
        return;
      }

      const storedLanguage = window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_LANGUAGE_KEY) : null;
      const storedPreference = storedLanguage ? normalizeLanguage(storedLanguage) : null;
      if (currentLanguage === 'en' && !hadDataParam && !normalizedLangParam) {
        const detected = window.VersionLanguageSelector && window.VersionLanguageSelector.detectLanguage
          ? window.VersionLanguageSelector.detectLanguage(currentLanguage)
          : normalizeLanguage(navigator.language || '');
        const preferred = storedPreference || detected;
        if (preferred === 'ja') {
          const url = new URL(LANGUAGE_PATHS.ja, window.location.origin);
          window.location.replace(url.toString());
          return;
        }
      }

      const loadMovesetsForVersion = async (version) => {
        const normalized = normalizeVersion(version);
        if (movesetCache[normalized]) {
          movesets = movesetCache[normalized];
          return movesets;
        }
        const filename = MOVESET_FILES[normalized];
        try {
          const response = await fetch(filename);
          if (response.ok) {
            const payload = await response.json();
            movesets = payload.movesets || {};
            movesetCache[normalized] = movesets;
          } else {
            console.error(`Failed to load ${filename}`, response.status);
            movesets = {};
          }
        } catch (error) {
          console.error(`Unable to load ${filename}`, error);
          movesets = {};
        }
        return movesets;
      };

      const applyGameVersion = async (version, { initial = false } = {}) => {
        const normalized = normalizeVersion(version);
        if (!initial && normalized === currentVersion) return;
        await loadMoveLabels();
        currentVersion = normalized;
        if (Smash64Calculator && typeof Smash64Calculator.setVersion === 'function') {
          Smash64Calculator.setVersion(normalized);
        }
        if (Smash64Calculator) {
          if (typeof Smash64Calculator.doubleJumpArmorValue === 'number') {
            doubleJumpArmorThreshold = Smash64Calculator.doubleJumpArmorValue;
          } else if (Smash64Calculator.doubleJumpArmorValues) {
            doubleJumpArmorThreshold = Smash64Calculator.doubleJumpArmorValues[normalized] ?? doubleJumpArmorThreshold;
          }
        }
        await loadMovesetsForVersion(normalized);

        if (initial) return;

        const preferredMove = lastMoveBaseName
          || (selectedMoveData ? (selectedMoveData.baseName || selectedMoveData.name || null) : null);
        setDefender(defenderSelect.value);
        updateDoubleJumpArmorVisibility({ skipCalculate: true });
        populateMoves(attackerSelect.value, { preferredMove });
        calculate();
      };

      const pendingVersion = initialDataState && initialDataState.version
        ? normalizeVersion(initialDataState.version)
        : null;
      const initialLanguage = normalizeLanguage(PAGE_LANGUAGE);
      let initialVersion = pendingVersion || VERSION_BY_LANGUAGE[initialLanguage] || 'U';
      if (window.VersionLanguageSelector && versionSelectorRoot) {
        const selector = window.VersionLanguageSelector.init({
          root: versionSelectorRoot,
          defaultLanguage: initialLanguage,
          initialLanguage,
          initialVersion,
          versionByLanguage: VERSION_BY_LANGUAGE,
          allowUrlParams: false,
          emitInitial: false,
          onChange: ({ language, version }) => {
            const normalizedLanguage = normalizeLanguage(language);
            if (normalizedLanguage !== currentLanguage) {
              if (window.localStorage) {
                window.localStorage.setItem(LOCAL_STORAGE_LANGUAGE_KEY, normalizedLanguage);
              }
              if (languageNavigationReady) {
                navigateToLanguage(normalizedLanguage);
              }
              return;
            }
            currentLanguage = normalizedLanguage;
            document.documentElement.lang = currentLanguage;
            if (version !== currentVersion) {
              applyGameVersion(version);
              markStateDirty();
            }
          },
        });
        const state = selector ? selector.getState() : null;
        if (state) {
          currentLanguage = normalizeLanguage(state.language);
          if (!pendingVersion) {
            initialVersion = normalizeVersion(state.version);
          }
        }
      } else {
        currentLanguage = languageSelect ? normalizeLanguage(languageSelect.value || currentLanguage) : currentLanguage;
        if (!pendingVersion) {
          initialVersion = versionSelect ? normalizeVersion(versionSelect.value || initialVersion) : initialVersion;
        }
      }

      document.documentElement.lang = currentLanguage;
      await applyGameVersion(initialVersion, { initial: true });
      if (versionSelect) {
        versionSelect.value = initialVersion;
      }

      Smash64Calculator.characters.forEach((character) => {
        const defenderOption = document.createElement('option');
        defenderOption.value = character.key;
        defenderOption.textContent = character.name;
        const optionMarkup = getCharacterOptionMarkup(character);
        if (optionMarkup) {
          defenderOption.dataset.html = optionMarkup;
        }
        defenderSelect.append(defenderOption);

        const attackerOption = document.createElement('option');
        attackerOption.value = character.key;
        attackerOption.textContent = character.name;
        if (optionMarkup) {
          attackerOption.dataset.html = optionMarkup;
        }
        attackerSelect.append(attackerOption);
      });

      defenderCustomOption = document.createElement('option');
      defenderCustomOption.value = '__custom__';
      defenderCustomOption.textContent = UI_TEXT.customCharacter;
      defenderSelect.append(defenderCustomOption);

      if (window.SlimSelect) {
        attackerDropdown = new SlimSelect({
          select: attackerSelect,
          settings: { showSearch: false }
        });
        defenderDropdown = new SlimSelect({
          select: defenderSelect,
          settings: { showSearch: false }
        });
      }

      function formatMoveDetails(option) {
        if (!option || option.value === '' || !option.dataset) {
          moveDetails.textContent = '';
          return;
        }
        const details = [];
        const gt = option.dataset.gt === '' ? null : Number(option.dataset.gt);
        const at = option.dataset.at === '' ? null : Number(option.dataset.at);
        if (gt !== null && at !== null) {
          if (gt === 1 && at === 0) details.push(UI_TEXT.moveDetails.groundOnly);
          if (gt === 0 && at === 1) details.push(UI_TEXT.moveDetails.airOnly);
          if (gt === 0 && at === 0) details.push(UI_TEXT.moveDetails.noHit);
        }
        const sd = option.dataset.sd === '' ? null : Number(option.dataset.sd);
        if (sd !== null && sd !== 0) {
          details.push(UI_TEXT.moveDetails.shieldDamage(sd));
        }
        moveDetails.textContent = details.join(' • ');
      }

      function setDefender(key) {
        if (defenderCustomOption && key === defenderCustomOption.value) {
          selectedDefenderData = null;
          return;
        }
        const info = Smash64Calculator.characters.find((entry) => entry.key === key);
        if (!info) {
          return;
        }
        suppressDefenderCustom = true;
        selectedDefenderData = {
          weight: Number(info.weight),
          fallAccel: Number(info.fallAccel),
          maxFall: Number(info.maxFall),
          traction: Number(info.traction ?? 1),
        };
        selectedDefenderTraction = Number(info.traction ?? selectedDefenderTraction ?? 1);
        weightInput.value = info.weight;
        fallAccelInput.value = info.fallAccel;
        maxFallInput.value = info.maxFall;
        suppressDefenderCustom = false;
      }

      function hasDefenderOverride() {
        if (!selectedDefenderData) return false;
        const tolerance = 1e-4;
        if (Math.abs(numericValue(weightInput, selectedDefenderData.weight) - selectedDefenderData.weight) > tolerance) return true;
        if (Math.abs(numericValue(fallAccelInput, selectedDefenderData.fallAccel) - selectedDefenderData.fallAccel) > tolerance) return true;
        if (Math.abs(numericValue(maxFallInput, selectedDefenderData.maxFall) - selectedDefenderData.maxFall) > tolerance) return true;
        return false;
      }

      function markDefenderCustom() {
        if (!defenderCustomOption) return;
        selectedDefenderData = null;
        suppressDefenderCustom = true;
        setSelectValue(defenderDropdown, defenderSelect, defenderCustomOption.value);
        suppressDefenderCustom = false;
      }

      function maybeMarkDefenderCustom() {
        if (suppressDefenderCustom) return;
        if (defenderCustomOption && defenderSelect.value === defenderCustomOption.value) {
          selectedDefenderData = null;
          return;
        }
        if (hasDefenderOverride()) {
          markDefenderCustom();
        }
      }

      function setCustomState(active) {
        if (!customOption) return;
        suppressCustomFlag = true;
        if (active) {
          customOption.textContent = UI_TEXT.customMove;
          setSelectValue(null, moveSelect, customOption.value);
          customOption.selected = true;
          selectedMoveIndex = null;
          selectedMoveData = null;
        } else {
          customOption.textContent = UI_TEXT.customMove;
        }
        suppressCustomFlag = false;
      }

      function populateMoves(key, { preferredMove = null, preferredSlot = null } = {}) {
        moveSelect.innerHTML = '';

        currentMoves = movesets[key] || [];
        const groupedMoves = new Map();
        currentMoves.forEach((move, index) => {
          const group = getMoveGroup(move);
          if (!groupedMoves.has(group)) {
            groupedMoves.set(group, []);
          }
          groupedMoves.get(group).push({ move, index });
        });

        const appendOption = (entry, parent) => {
          const { move, index } = entry;
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = getMoveLabel(move);
          Object.assign(option.dataset, {
            effect: move.effect || '',
            damage: move.damage ?? '',
            angle: move.angle ?? '',
            kbs: move.kbs ?? '',
            bkb: move.bkb ?? '',
            fkb: move.fkb ?? '',
            gt: move.gt ?? '',
            at: move.at ?? '',
            sd: move.sd ?? '',
            throw: move.throw ? 'true' : '',
          });
          parent.append(option);
        };

        const groupElements = new Map();
        const appendGroup = (group) => {
          const entries = groupedMoves.get(group);
          if (!entries || entries.length === 0) return;
          const label = getMoveGroupLabel(group);
          const groupEl = document.createElement('optgroup');
          groupEl.label = label;
          entries.forEach((entry) => appendOption(entry, groupEl));
          moveSelect.append(groupEl);
          groupElements.set(group, groupEl);
        };

        MOVE_GROUP_ORDER.forEach((group) => appendGroup(group));
        groupedMoves.forEach((_, group) => {
          if (!MOVE_GROUP_ORDER.includes(group)) {
            appendGroup(group);
          }
        });

        customOption = document.createElement('option');
        customOption.value = '';
        customOption.textContent = UI_TEXT.customMove;
        let customGroup = groupElements.get('other');
        if (!customGroup) {
          customGroup = document.createElement('optgroup');
          customGroup.label = getMoveGroupLabel('other');
          moveSelect.append(customGroup);
          groupElements.set('other', customGroup);
        }
        customGroup.append(customOption);

        let selectedOption = null;
        if (currentMoves.length > 0) {
          if (Number.isFinite(preferredSlot)) {
            const slotIndex = Math.min(Math.max(0, Math.trunc(preferredSlot)), currentMoves.length - 1);
            moveSelect.value = String(slotIndex);
          } else if (preferredMove) {
            const matchIndex = currentMoves.findIndex((move) => {
              const baseName = move.baseName ?? move.name ?? '';
              return baseName === preferredMove || move.name === preferredMove;
            });
            if (matchIndex >= 0) {
              moveSelect.value = String(matchIndex);
            }
          }
          if (!moveSelect.value) {
            moveSelect.value = '0';
          }
          selectedOption = moveSelect.selectedOptions && moveSelect.selectedOptions[0]
            ? moveSelect.selectedOptions[0]
            : moveSelect.options[moveSelect.selectedIndex];
        } else {
          moveSelect.value = '';
          selectedOption = customOption;
        }

        if (!selectedOption) {
          moveSelect.value = '';
          selectedOption = customOption;
        }
        applyMove(selectedOption);
      }

      async function applyStateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        suppressUrlSync = true;
        const targetVersion = snapshot.version ? normalizeVersion(snapshot.version) : currentVersion;
        await applyGameVersion(targetVersion, { initial: true });
        if (versionSelect) {
          versionSelect.value = targetVersion;
        }

        if (snapshot.defender) {
          setSelectValue(defenderDropdown, defenderSelect, snapshot.defender);
          setDefender(snapshot.defender);
        }

        if (snapshot.attacker) {
          setSelectValue(attackerDropdown, attackerSelect, snapshot.attacker);
        }

        const preferredSlot = (typeof snapshot.moveSlot === 'number' && Number.isFinite(snapshot.moveSlot))
          ? Math.max(0, Math.trunc(snapshot.moveSlot))
          : null;

        populateMoves(attackerSelect.value, { preferredSlot });

        if (typeof snapshot.damage === 'number') damageInput.value = snapshot.damage;
        if (typeof snapshot.angle === 'number') angleInput.value = snapshot.angle;
        if (typeof snapshot.kbs === 'number') kbsInput.value = snapshot.kbs;
        if (typeof snapshot.bkb === 'number') bkbInput.value = snapshot.bkb;
        if (typeof snapshot.fkb === 'number') fkbInput.value = snapshot.fkb;
        if (typeof snapshot.hp === 'number') hpInput.value = snapshot.hp;
        if (typeof snapshot.weight === 'number') weightInput.value = snapshot.weight;
        if (typeof snapshot.fallAccel === 'number') fallAccelInput.value = snapshot.fallAccel;
        if (typeof snapshot.maxFall === 'number') maxFallInput.value = snapshot.maxFall;
        if (typeof snapshot.attackHandicap === 'number') attackHandicapInput.value = snapshot.attackHandicap;
        if (typeof snapshot.defenseHandicap === 'number') defenseHandicapInput.value = snapshot.defenseHandicap;
        if (typeof snapshot.comboDelay === 'number') comboDelayInput.value = snapshot.comboDelay;

        if (typeof snapshot.electric === 'boolean') electricToggle.checked = snapshot.electric;
        if (typeof snapshot.throwMove === 'boolean') throwToggle.checked = snapshot.throwMove;

        if (typeof snapshot.targetState === 'string') targetStateSelect.value = snapshot.targetState;
        if (typeof snapshot.attackDirection === 'string') {
          setAttackDirection(snapshot.attackDirection, { trigger: false });
        }
        if (typeof snapshot.simulation === 'string') simulationSelect.value = snapshot.simulation;
        updateComboDelayVisibility();

        if (snapshot.position && snapshot.position.custom && typeof snapshot.position.x === 'number' && typeof snapshot.position.y === 'number') {
          setCustomPositionDirect(snapshot.position.x, snapshot.position.y);
        } else if (snapshot.position) {
          state.suppressPositionChange = true;
          if (typeof snapshot.position.horizontal === 'string') {
            positionHorizontalSelect.value = snapshot.position.horizontal;
          }
          if (typeof snapshot.position.vertical === 'string') {
            positionVerticalSelect.value = snapshot.position.vertical;
          }
          state.customPosition = null;
          state.suppressPositionChange = false;
          syncPositionInputs();
        }

        if (typeof snapshot.snap === 'boolean' && snapToggle) {
          snapToggle.checked = snapshot.snap;
          trajectoryState.snapEnabled = snapshot.snap;
        }

        if (typeof snapshot.cameraMode === 'string') {
          setCameraMode(snapshot.cameraMode, { trigger: false });
        }

        if (typeof snapshot.staleness === 'string') {
          setStaleness(snapshot.staleness, { trigger: false });
        }

        if (typeof snapshot.doubleJumpArmor === 'boolean' && doubleJumpArmorToggle) {
          doubleJumpArmorToggle.checked = snapshot.doubleJumpArmor;
        }

        if (typeof snapshot.debug === 'boolean' && debugToggle) {
          debugToggle.checked = snapshot.debug;
          debugMode = snapshot.debug;
        }

        maybeMarkDefenderCustom();

        updateDoubleJumpArmorVisibility({ skipCalculate: true });

        calculate();

        stateDirty = false;
        suppressUrlSync = false;
      }

      function applyMove(option) {
        if (!option) return;
        suppressCustomFlag = true;
        if (option.value !== '') {
          selectedMoveIndex = Number(option.value);
          const move = currentMoves[selectedMoveIndex];
          const isElectric = (move.effect || '').toLowerCase() === 'electric';
          const isThrow = Boolean(move.throw);
          lastMoveBaseName = move.baseName ?? move.name ?? lastMoveBaseName;
          state.selectedMoveShieldDamage = Number.isFinite(move.sd) ? Number(move.sd) : 0;
          selectedMoveData = {
            damage: move.damage ?? 0,
            angle: move.angle ?? 0,
            kbs: move.kbs ?? 0,
            bkb: move.bkb ?? 0,
            fkb: move.fkb ?? 0,
            electric: isElectric,
            throwMove: isThrow,
            baseName: move.baseName ?? move.name ?? '',
            name: move.name ?? '',
          };
          damageInput.value = move.damage ?? '';
          angleInput.value = move.angle ?? '';
          kbsInput.value = move.kbs ?? '';
          bkbInput.value = move.bkb ?? '';
          fkbInput.value = move.fkb ?? 0;
          electricToggle.checked = selectedMoveData.electric;
          throwToggle.checked = selectedMoveData.throwMove;
          formatMoveDetails(option);
        } else {
          selectedMoveIndex = null;
          selectedMoveData = null;
          state.selectedMoveShieldDamage = 0;
          formatMoveDetails(option);
        }
        suppressCustomFlag = false;
        calculate();
      }

      function hasMoveOverride() {
        if (selectedMoveData === null) return false;
        const tolerance = 1e-4;
        if (Math.abs(numericValue(damageInput, 0) - selectedMoveData.damage) > tolerance) return true;
        if (Math.abs(numericValue(angleInput, 0) - selectedMoveData.angle) > tolerance) return true;
        if (Math.abs(numericValue(kbsInput, 0) - selectedMoveData.kbs) > tolerance) return true;
        if (Math.abs(numericValue(bkbInput, 0) - selectedMoveData.bkb) > tolerance) return true;
        if (Math.abs(numericValue(fkbInput, 0) - selectedMoveData.fkb) > tolerance) return true;
        if (electricToggle.checked !== selectedMoveData.electric) return true;
        if (throwToggle.checked !== selectedMoveData.throwMove) return true;
        return false;
      }

      function maybeMarkCustom() {
        if (suppressCustomFlag) return;
        if (selectedMoveIndex === null) return;
        if (hasMoveOverride()) {
          setCustomState(true);
          formatMoveDetails(customOption);
          calculate();
        }
      }

      function updateHandicapMultipliers(attackIdx, defenseIdx) {
        const atkMultiplier = Smash64Calculator.attackMultipliers[attackIdx] ?? 1;
        const defMultiplier = Smash64Calculator.defenseMultipliers[defenseIdx] ?? 1;
        outputNodes.attackMult.textContent = formatStandard(atkMultiplier, 3);
        outputNodes.defenseMult.textContent = formatStandard(defMultiplier, 3);
      }

      function updateVector(vx, vy) {
        if (!outputNodes.vectorLine) return;
        const magnitude = Math.hypot(vx, vy);
        const maxLength = 46;
        const scale = magnitude > 0 ? Math.min(1, maxLength / magnitude) : 0;
        const x2 = 60 + vx * scale;
        const y2 = 60 - vy * scale;
        outputNodes.vectorLine.setAttribute('x2', Number.isFinite(x2) ? x2 : 60);
        outputNodes.vectorLine.setAttribute('y2', Number.isFinite(y2) ? y2 : 60);
        outputNodes.vectorLine.style.opacity = magnitude > 0 ? 1 : 0.25;
        outputNodes.velocityMag.textContent = formatStandard(magnitude);
      }

      function calculate() {
        const attackIndex = Math.min(40, Math.max(0, Math.trunc(numericValue(attackHandicapInput, 9))));
        const defenseIndex = Math.min(40, Math.max(0, Math.trunc(numericValue(defenseHandicapInput, 9))));

        const simulationMode = simulationSelect.value;
        const attackDirection = state.attackDirection || 'right';
        const attackDirectionSign = attackDirection === 'left' ? -1 : 1;
        const rawComboDelay = numericValue(comboDelayInput, 0);
        const comboDelayValue = Math.max(0, Math.trunc(rawComboDelay));
        const customFrameLimit = simulationMode === 'custom' ? comboDelayValue : null;
        const comboDelayFrames = simulationMode === 'custom' ? comboDelayValue + 1 : 0;

        const dropdownPosition = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
        const position = state.customPosition ? { x: state.customPosition.x, y: state.customPosition.y } : dropdownPosition;
        const defenderTraction = Number.isFinite(selectedDefenderTraction)
          ? selectedDefenderTraction
          : (selectedDefenderData && Number.isFinite(selectedDefenderData.traction)
            ? selectedDefenderData.traction
            : 1);
        const groundPlanes = Object.values(POSITION_DATA).reduce((planes, platform) => {
          if (!platform) return planes;
          const xMin = platform.center - platform.halfWidth;
          const xMax = platform.center + platform.halfWidth;
          planes.push({ xMin, xMax, y: platform.y });
          return planes;
        }, []);

        const yoshiSelected = isYoshiDefender();
        const doubleJumpArmorActive = yoshiSelected && doubleJumpArmorToggle && doubleJumpArmorToggle.checked;

        const params = {
          weight: numericValue(weightInput, 1),
          fallAccel: numericValue(fallAccelInput, 0),
          maxFall: numericValue(maxFallInput, 0),
          hp: numericValue(hpInput, 0),
          baseDamage: numericValue(damageInput, 0),
          baseKnockback: numericValue(bkbInput, 0),
          knockbackScaling: numericValue(kbsInput, 0),
          fixedKnockback: numericValue(fkbInput, 0),
          angle: numericValue(angleInput, 0),
          attackHandicapIndex: attackIndex,
          defenseHandicapIndex: defenseIndex,
          damageModifier: state.stalenessValue,
          targetState: targetStateSelect.value,
          electric: electricToggle.checked,
          throwMove: throwToggle.checked,
          doubleJumpArmor: doubleJumpArmorActive,
          simulationMode,
          comboDelay: comboDelayFrames,
          startX: position.x,
          startY: position.y,
          traction: defenderTraction,
          groundPlanes,
        };

        const result = Smash64Calculator.compute(params);
        const hitstunParams = (customFrameLimit !== null)
          ? { ...params, simulationMode: 'hitstun', comboDelay: 0 }
          : params;
        const computeAtPercent = (hpValue) => Smash64Calculator.compute({ ...params, hp: hpValue });
        const computeAtPercentForThreshold = (hpValue) => Smash64Calculator.compute({ ...hitstunParams, hp: hpValue });
        const thresholdStepSize = 1;
        const thresholdMaxPercent = 300;
        const startPercent = params.hp;
        const staledDamage = Smash64Calculator.applyStaleness(params.baseDamage, params.damageModifier);
        const appliedDamage = params.targetState === 'laying' ? Math.ceil(staledDamage / 2) : staledDamage;
        const finalPercent = startPercent + appliedDamage;

        outputNodes.finalPercent.textContent = formatPercent(finalPercent);
        const percentSummary = `${formatPercent(startPercent)} + ${formatPercent(appliedDamage)}`;
        outputNodes.percentBreakdown.textContent = state.stalenessValue !== 'fresh'
          ? UI_TEXT.afterStaleness({ summary: percentSummary })
          : percentSummary;

        if (params.fixedKnockback > 0) {
          outputNodes.knockbackBreakdown.textContent = UI_TEXT.fixedKnockbackOnly;
        } else {
          outputNodes.knockbackBreakdown.textContent = UI_TEXT.baseScaling({
            base: formatStandard(params.baseKnockback),
            scaling: formatStandard(params.knockbackScaling),
          });
        }

        const displayHitstun = Math.max(0, Number.isFinite(result.simulatedHitstun) ? result.simulatedHitstun : result.hitstun);
        const hitlagFrames = Math.max(0, Math.trunc(result.hitlag));
        const diFrames = Math.max(0, hitlagFrames - 1);
        const hitlagText = UI_TEXT.hitlagFrames({ frames: formatIntegral(hitlagFrames) });
        const hitlagHint = UI_TEXT.hitlagDIHint({ frames: formatIntegral(diFrames) });
        setHintedValue(outputNodes.hitlag, hitlagText, hitlagHint);
        outputNodes.hitstun.textContent = UI_TEXT.hitstunFrames({ frames: formatIntegral(displayHitstun) });
        outputNodes.knockdown.textContent = result.hitstun >= 32 ? UI_TEXT.knocksDown : UI_TEXT.noKnockdown;
        if (outputNodes.shieldDamage && outputNodes.shieldstun) {
          const shieldDamageTotal = Smash64Calculator.computeShieldDamage(
            params.baseDamage,
            params.damageModifier,
            state.selectedMoveShieldDamage
          );
          const shieldstunFrames = Smash64Calculator.computeShieldstun(staledDamage);
          const shieldDamageText = formatIntegral(shieldDamageTotal);
          const shieldDamageHint = UI_TEXT.shieldDamageHint({ max: SHIELD_HEALTH_MAX });
          setHintedValue(outputNodes.shieldDamage, shieldDamageText, shieldDamageHint);
          outputNodes.shieldstun.textContent = UI_TEXT.shieldstunFrames({
            frames: formatIntegral(shieldstunFrames),
          });
        }

        let knockdownThreshold = null;
        let knockdownTest = 0;
        while (knockdownTest <= thresholdMaxPercent) {
          const knockdownSim = computeAtPercent(knockdownTest);
          if (knockdownSim.hitstun >= 32) {
            knockdownThreshold = Math.round(knockdownTest);
            break;
          }
          knockdownTest += thresholdStepSize;
        }
        outputNodes.knockdownThresholdOutput.textContent = knockdownThreshold !== null
          ? UI_TEXT.knockdownAt({ percent: formatIntegral(knockdownThreshold) })
          : '';

        if (outputNodes.knockdownRow && outputNodes.armorBlock && outputNodes.armorStatus && outputNodes.armorThresholdOutput) {
          if (yoshiSelected) {
            outputNodes.knockdownRow.classList.add('has-armor');
            outputNodes.armorBlock.classList.remove('hidden');

            const armorParams = {
              ...params,
              targetState: 'airborne',
              doubleJumpArmor: false,
            };
            const armorResult = Smash64Calculator.compute(armorParams);
            const rawArmorKnockback = typeof armorResult.knockbackBeforeArmor === 'number'
              ? armorResult.knockbackBeforeArmor
              : armorResult.knockback;

            let armorThreshold = null;
            let armorTestPercent = 0;
            while (armorTestPercent <= thresholdMaxPercent) {
              const armorTestResult = Smash64Calculator.compute({
                ...armorParams,
                hp: armorTestPercent,
              });
              const armorTestKnockback = typeof armorTestResult.knockbackBeforeArmor === 'number'
                ? armorTestResult.knockbackBeforeArmor
                : armorTestResult.knockback;
              if (armorTestKnockback >= doubleJumpArmorThreshold) {
                armorThreshold = Math.round(armorTestPercent);
                break;
              }
              armorTestPercent += thresholdStepSize;
            }

            const breaksArmor = rawArmorKnockback >= doubleJumpArmorThreshold;
            outputNodes.armorStatus.textContent = breaksArmor ? UI_TEXT.breaksArmor : UI_TEXT.noBreakArmor;
            outputNodes.armorThresholdOutput.textContent = armorThreshold !== null
              ? UI_TEXT.breaksArmorAt({ percent: formatIntegral(armorThreshold) })
              : '';
          } else {
            outputNodes.knockdownRow.classList.remove('has-armor');
            outputNodes.armorBlock.classList.add('hidden');
            outputNodes.armorStatus.textContent = '—';
            outputNodes.armorThresholdOutput.textContent = '';
          }
        }

        if (outputNodes.positionOutput) {
          outputNodes.positionOutput.textContent = `(${formatIntegral(position.x)}, ${formatIntegral(position.y)})`;
        }

        const resolvedAngleDeg = typeof result.resolvedAngle === 'number' ? result.resolvedAngle : params.angle;
        const angleRadians = resolvedAngleDeg * (Math.PI / 180);
        const fallbackHorizontal = (() => {
          if (!Number.isFinite(angleRadians)) return Math.abs(result.initialVelocityX) < 1e-6 ? 0 : 1;
          const cosValue = Math.cos(angleRadians);
          if (Math.abs(cosValue) < 1e-6) return 0;
          return cosValue > 0 ? 1 : -1;
        })();
        const fallbackVertical = (() => {
          if (!Number.isFinite(angleRadians)) return Math.abs(result.initialVelocityY) < 1e-6 ? 0 : 1;
          const sinValue = Math.sin(angleRadians);
          if (Math.abs(sinValue) < 1e-6) return 0;
          return sinValue > 0 ? 1 : -1;
        })();

        const horizontalDirection = (typeof result.horizontalDirection === 'number')
          ? result.horizontalDirection
          : fallbackHorizontal;
        const verticalDirection = (typeof result.verticalDirection === 'number')
          ? result.verticalDirection
          : fallbackVertical;

        const signedInitialVX = result.initialVelocityX
          * (horizontalDirection === 0 ? 0 : horizontalDirection)
          * attackDirectionSign;
        const signedInitialVY = result.initialVelocityY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.initVx.textContent = formatStandard(signedInitialVX);
        outputNodes.initVy.textContent = formatStandard(signedInitialVY);

        const signedXDistance = result.totalDistanceX
          * (horizontalDirection === 0 ? 0 : horizontalDirection)
          * attackDirectionSign;
        const signedYDistance = result.totalDistanceY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.totalX.textContent = formatStandard(signedXDistance);
        outputNodes.totalY.textContent = formatStandard(signedYDistance);
        const finalX = position.x + signedXDistance;
        const finalY = position.y + signedYDistance;
        outputNodes.finalPosition.textContent = `(${formatIntegral(finalX)}, ${formatIntegral(finalY)})`;

        const trajectoryDirectionX = (horizontalDirection === 0 ? 0 : horizontalDirection) * attackDirectionSign;
        const trajectoryDirectionY = verticalDirection === 0 ? 0 : verticalDirection;
        const trajectoryPoints = (result.trajectory || []).map((step) => ({
          frame: step.frame,
          x: position.x + step.x * trajectoryDirectionX,
          y: position.y + step.y * trajectoryDirectionY,
        }));
        if (trajectoryPoints.length === 0) {
          trajectoryPoints.push({ frame: 0, x: position.x, y: position.y });
        }
        updateTrajectoryDisplay(position, trajectoryPoints, { x: finalX, y: finalY }, displayHitstun, {
          killFrameLimit: customFrameLimit,
          allowEndPointWhenKill: customFrameLimit !== null,
        });

        outputNodes.killThresholdOutput.textContent = '';

        const getKillLabel = (point) => {
          if (!point) return UI_TEXT.noKill;
          if (point.y >= BLASTZONE_LIMITS.top) {
            return UI_TEXT.killsOffTop;
          }
          if (point.y <= BLASTZONE_LIMITS.bottom) {
            return UI_TEXT.killsOffBottom;
          }
          if (point.x <= BLASTZONE_LIMITS.left) {
            return UI_TEXT.killsOffLeft;
          }
          if (point.x >= BLASTZONE_LIMITS.right) {
            return UI_TEXT.killsOffRight;
          }
          return UI_TEXT.noKill;
        };

        let killEntryPoint = null;
        for (let i = 0; i < trajectoryPoints.length; i += 1) {
          const point = trajectoryPoints[i];
          if (isKill(point.x, point.y)) {
            killEntryPoint = point;
            break;
          }
        }
        const finalKillPoint = isKill(finalX, finalY)
          ? { frame: displayHitstun, x: finalX, y: finalY }
          : null;

        let killResult = UI_TEXT.noKill;
        if (customFrameLimit !== null) {
          const killPoint = killEntryPoint || finalKillPoint;
          if (killPoint) {
            if (customFrameLimit < killPoint.frame) {
              killResult = UI_TEXT.killsOnFrame({ frame: killPoint.frame });
            } else {
              killResult = getKillLabel(killPoint);
            }
          }
        } else if (killEntryPoint || finalKillPoint) {
          killResult = getKillLabel(killEntryPoint || finalKillPoint);
        }
        outputNodes.killOutput.textContent = killResult;

        let killThreshold = null;
        let testPercent = 0;
        while (testPercent <= thresholdMaxPercent) {
          const sim = computeAtPercentForThreshold(testPercent);
          const simResolvedAngle = typeof sim.resolvedAngle === 'number' ? sim.resolvedAngle : resolvedAngleDeg;
          const simAngleRad = simResolvedAngle * (Math.PI / 180);
          const fallbackSimHorizontal = (() => {
            if (!Number.isFinite(simAngleRad)) return Math.abs(sim.initialVelocityX) < 1e-6 ? 0 : 1;
            const cosValue = Math.cos(simAngleRad);
            if (Math.abs(cosValue) < 1e-6) return 0;
            return cosValue > 0 ? 1 : -1;
          })();
          const fallbackSimVertical = (() => {
            if (!Number.isFinite(simAngleRad)) return Math.abs(sim.initialVelocityY) < 1e-6 ? 0 : 1;
            const sinValue = Math.sin(simAngleRad);
            if (Math.abs(sinValue) < 1e-6) return 0;
            return sinValue > 0 ? 1 : -1;
          })();
          const simHorizontalDirection = (typeof sim.horizontalDirection === 'number')
            ? sim.horizontalDirection
            : fallbackSimHorizontal;
          const simVerticalDirection = (typeof sim.verticalDirection === 'number')
            ? sim.verticalDirection
            : fallbackSimVertical;
          const simSignedX = sim.totalDistanceX
            * (simHorizontalDirection === 0 ? 0 : simHorizontalDirection)
            * attackDirectionSign;
          const simSignedY = sim.totalDistanceY * (simVerticalDirection === 0 ? 0 : simVerticalDirection);
          const testPos = {
            x: position.x + simSignedX,
            y: position.y + simSignedY,
          };
          let killsDuringTrajectory = false;
          if (Array.isArray(sim.trajectory) && sim.trajectory.length > 0) {
            for (let i = 0; i < sim.trajectory.length; i += 1) {
              const step = sim.trajectory[i];
              const stepX = position.x
                + step.x * (simHorizontalDirection === 0 ? 0 : simHorizontalDirection) * attackDirectionSign;
              const stepY = position.y + step.y * (simVerticalDirection === 0 ? 0 : simVerticalDirection);
              if (isKill(stepX, stepY)) {
                killsDuringTrajectory = true;
                break;
              }
            }
          }
          if (killsDuringTrajectory || isKill(testPos.x, testPos.y)) {
            killThreshold = Math.round(testPercent);
            break;
          }
          testPercent += thresholdStepSize;
        }

        outputNodes.killThresholdOutput.textContent = killThreshold !== null && killThreshold <= thresholdMaxPercent
          ? UI_TEXT.killsAt({ percent: formatIntegral(killThreshold) })
          : '';

        const landedDuringHitstun = Number.isFinite(result.simulatedHitstun)
          && Number.isFinite(result.hitstun)
          && result.simulatedHitstun < result.hitstun;
        const effectiveCustomFrame = (simulationMode === 'custom' && customFrameLimit !== null && landedDuringHitstun)
          ? Math.min(customFrameLimit, result.simulatedHitstun)
          : customFrameLimit;

        let framesSimulated = null;
        if (simulationMode === 'hitstun') {
          framesSimulated = displayHitstun;
        } else if (simulationMode === 'custom') {
          framesSimulated = effectiveCustomFrame;
        }
        if (framesSimulated !== null) {
          const label = simulationMode === 'custom'
            ? UI_TEXT.displacement.frames
            : UI_TEXT.displacement.hitstunFrames;
          outputNodes.displacementMeta.textContent = UI_TEXT.displacement.after({
            frames: formatIntegral(framesSimulated),
            label,
          });
        } else {
          outputNodes.displacementMeta.textContent = UI_TEXT.displacement.whenZero;
        }

        updateVector(signedInitialVX, signedInitialVY);
        updateHandicapMultipliers(attackIndex, defenseIndex);
      }
      app.calculate = calculate;

      const handleInputChange = () => {
        calculate();
        markStateDirty();
      };

      defenderSelect.addEventListener('change', () => {
        if (defenderCustomOption && defenderSelect.value === defenderCustomOption.value) {
          selectedDefenderData = null;
        } else {
          setDefender(defenderSelect.value);
        }
        updateDoubleJumpArmorVisibility();
        calculate();
        markStateDirty();
      });

      attackerSelect.addEventListener('change', () => {
        const preferredMove = lastMoveBaseName
          || (selectedMoveData ? (selectedMoveData.baseName || selectedMoveData.name || null) : null);
        populateMoves(attackerSelect.value, { preferredMove });
        markStateDirty();
      });

      moveSelect.addEventListener('change', () => {
        applyMove(moveSelect.options[moveSelect.selectedIndex]);
        markStateDirty();
      });

      [damageInput, angleInput, kbsInput, bkbInput, fkbInput].forEach((input) => {
        input.addEventListener('input', maybeMarkCustom);
      });
      electricToggle.addEventListener('change', maybeMarkCustom);
      throwToggle.addEventListener('change', maybeMarkCustom);

      [weightInput, fallAccelInput, maxFallInput].forEach((input) => {
        input.addEventListener('input', maybeMarkDefenderCustom);
        input.addEventListener('change', maybeMarkDefenderCustom);
      });

      [electricToggle, throwToggle, targetStateSelect,
        comboDelayInput, attackHandicapInput, defenseHandicapInput,
        weightInput, fallAccelInput, maxFallInput, hpInput,
        damageInput, angleInput, kbsInput, bkbInput, fkbInput].forEach((node) => {
        if (!node) return;
        node.addEventListener('input', handleInputChange);
        node.addEventListener('change', handleInputChange);
      });

      if (doubleJumpArmorToggle) {
        doubleJumpArmorToggle.addEventListener('change', () => {
          enforceDoubleJumpArmorState({ forceCalculate: true });
          markStateDirty();
        });
      }

      targetStateSelect.addEventListener('change', () => {
        if (isYoshiDefender() && doubleJumpArmorToggle && doubleJumpArmorToggle.checked) {
          if (targetStateSelect.value !== 'airborne') {
            targetStateSelect.value = 'airborne';
            return;
          }
          state.autoAirborneActive = true;
          return;
        }
        if (targetStateSelect.value !== 'airborne') {
          state.lastGroundState = targetStateSelect.value || state.lastGroundState;
          state.autoAirborneActive = false;
        }
      });

      if (positionXInput && positionYInput) {
        const handlePositionInput = () => {
          if (state.suppressCustomPositionInput) return;
          const x = Number.parseFloat(positionXInput.value);
          const y = Number.parseFloat(positionYInput.value);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
          }
          if (typeof setPositionFromStageCoords === 'function') {
            setPositionFromStageCoords(x, y, { forceUpdate: true, allowSnap: false });
            return;
          }
          setCustomPositionDirect(x, y);
          calculate();
          markStateDirty();
        };

        const handlePositionKeydown = (event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
          }
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? 1 : -1;
          const target = event.target;
          if (!(target instanceof HTMLInputElement)) return;
          const current = Number.parseFloat(target.value);
          const next = Number.isFinite(current) ? current + delta : delta;
          target.value = formatPositionInputValue(next);
          handlePositionInput();
        };

        positionXInput.addEventListener('input', handlePositionInput);
        positionYInput.addEventListener('input', handlePositionInput);
        positionXInput.addEventListener('keydown', handlePositionKeydown);
        positionYInput.addEventListener('keydown', handlePositionKeydown);
      }

      positionHorizontalSelect.addEventListener('change', () => {
        if (state.suppressPositionChange) return;
        if (typeof setPositionFromStageCoords === 'function') {
          const coords = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
          setPositionFromStageCoords(coords.x, coords.y, { forceUpdate: true, forceSnap: true });
          return;
        }
        state.customPosition = null;
        syncPositionInputs();
        calculate();
        markStateDirty();
      });

      positionVerticalSelect.addEventListener('change', () => {
        if (state.suppressPositionChange) return;
        if (typeof setPositionFromStageCoords === 'function') {
          const coords = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
          setPositionFromStageCoords(coords.x, coords.y, { forceUpdate: true, forceSnap: true });
          return;
        }
        state.customPosition = null;
        syncPositionInputs();
        calculate();
        markStateDirty();
      });

      simulationSelect.addEventListener('change', () => {
        updateComboDelayVisibility();
        calculate();
        markStateDirty();
      });

      debugToggle.addEventListener('change', () => {
        debugMode = debugToggle.checked;
        calculate();
        markStateDirty();
      });

      stalenessButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const value = button.dataset.staleness;
          if (!value) return;
          setStaleness(value);
          markStateDirty();
        });
      });

      if (Array.isArray(attackDirectionButtons)) {
        attackDirectionButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const value = button.dataset.attackDirection;
            if (!value) return;
            setAttackDirection(value);
            markStateDirty();
          });
        });
      }

      cameraButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const mode = button.dataset.cameraMode;
          if (!mode) return;
          setCameraMode(mode);
          markStateDirty();
        });
      });

      if (snapToggle) {
        trajectoryState.snapEnabled = snapToggle.checked;
        snapToggle.addEventListener('change', () => {
          trajectoryState.snapEnabled = snapToggle.checked;
          if (trajectoryState.snapEnabled && state.customPosition) {
            setPositionFromStageCoords(state.customPosition.x, state.customPosition.y, true);
          }
          markStateDirty();
        });
      }

      if (copyLinkButton) {
        copyLinkButton.addEventListener('click', () => {
          copyCurrentLink();
        });
      }

      if (resetButton) {
        resetButton.addEventListener('click', () => {
          resetToDefaults();
        });
      }

      if (backgroundToggle && backgroundSelector) {
        backgroundToggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleBackgroundMenu();
        });
      }

      if (backgroundMenu) {
        backgroundMenu.addEventListener('click', (event) => {
          const button = event.target.closest('[data-bg-option]');
          if (!button) return;
          event.preventDefault();
          setBackgroundMode(button.dataset.bgOption);
          toggleBackgroundMenu(false);
        });
      }

      document.addEventListener('click', (event) => {
        if (!backgroundSelector) return;
        if (!backgroundSelector.contains(event.target)) {
          toggleBackgroundMenu(false);
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          toggleBackgroundMenu(false);
        }
      });

      syncPositionInputs();

      setStaleness(state.stalenessValue, { trigger: false });
      setCameraMode(trajectoryState.cameraMode, { trigger: false });
      setAttackDirection(state.attackDirection, { trigger: false });

      if (trajectoryElements.svg) {
        applyTrajectoryViewBox(trajectoryState.viewBox);
        renderStageGeometry();
        trajectoryElements.svg.addEventListener('pointerdown', handleTrajectoryPointerDown);
        trajectoryElements.svg.addEventListener('pointermove', handleTrajectoryPointerMove);
        trajectoryElements.svg.addEventListener('pointerup', handleTrajectoryPointerUp);
        trajectoryElements.svg.addEventListener('pointercancel', handleTrajectoryPointerUp);
      }

      const defaultCharacter = Smash64Calculator.characters[0];
      if (defaultCharacter) {
        setDefender(defaultCharacter.key);
        setSelectValue(defenderDropdown, defenderSelect, defaultCharacter.key);
        setSelectValue(attackerDropdown, attackerSelect, defaultCharacter.key);
        populateMoves(attackerSelect.value);
      }
      updateDoubleJumpArmorVisibility({ skipCalculate: true });
      updateComboDelayVisibility();

      baselineState = buildStateSnapshot();

      const storedBackground = window.localStorage ? window.localStorage.getItem(BACKGROUND_STORAGE_KEY) : null;
      const defaultBackground = trajectoryElements && trajectoryElements.svg && trajectoryElements.svg.dataset.bg
        ? trajectoryElements.svg.dataset.bg
        : 'full';
      setBackgroundMode(storedBackground || defaultBackground, { save: false });

      if (initialDataState) {
        const expandedState = expandStateFromDelta(baselineState, initialDataState);
        if (expandedState) {
          await applyStateSnapshot(expandedState);
        }
      } else {
        calculate();
        suppressUrlSync = false;
      }

      languageNavigationReady = true;
    })();
