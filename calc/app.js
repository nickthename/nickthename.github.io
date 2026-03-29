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
        stalenessControl,
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
        comboStrip,
        comboSummaryCard,
        comboTotalDamageOutput,
        comboFinalPercentOutput,
        comboKillOutput,
        comboKillThresholdButton,
      } = elements;

      const {
        BLASTZONE_LIMITS = { left: -9000, right: 9000, bottom: -3500, top: 8300 },
        POSITION_DATA = {
          stage: { y: 0, center: 0, spawnX: 0, halfWidth: 2318 },
          'left-platform': { y: 904, center: -1396, spawnX: -1397, halfWidth: 445 },
          'right-platform': { y: 907, center: 1421.5, spawnX: 1421, halfWidth: 470.5 },
          'top-platform': { y: 1542, center: 0, spawnX: 1, halfWidth: 570 },
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
      state.comboLockPosition = state.comboLockPosition ?? false;
      state.suppressComboCalculation = state.suppressComboCalculation ?? false;
      state.comboLockStaleness = state.comboLockStaleness ?? false;

      const comboState = state.combo || (state.combo = {});
      comboState.activeIndex = Number.isFinite(comboState.activeIndex) ? comboState.activeIndex : 0;
      comboState.moves = Array.isArray(comboState.moves) ? comboState.moves : [];
      comboState.derived = Array.isArray(comboState.derived) ? comboState.derived : [];
      comboState.global = comboState.global && typeof comboState.global === 'object' ? comboState.global : {};

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

      const getCharacterOptionMarkup = (character, labelOverride = null) => {
        const iconPath = CHARACTER_ICONS[character.key];
        if (!iconPath) return null;
        const label = labelOverride || character.name;
        return `<img src="${iconPath}" alt="" role="presentation">${label}`;
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
        const presetCenterX = Number.isFinite(platform.spawnX) ? platform.spawnX : platform.center;
        let x = presetCenterX;
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

      const LOCKED_FIELD_HINT = UI_TEXT.lockedFieldHint || 'Field locked from preceding combo hit.';

      const setLockedField = (node, locked) => {
        if (!node) return;
        node.classList.toggle('is-locked-field', locked);
        if (node.tagName === 'INPUT') {
          node.readOnly = locked;
        } else if (node.tagName === 'SELECT') {
          node.disabled = locked;
        }
        const label = node.id ? document.querySelector(`label[for="${node.id}"]`) : null;
        if (label) {
          if (locked) {
            label.dataset.lockedTitle = LOCKED_FIELD_HINT;
            label.title = LOCKED_FIELD_HINT;
          } else if (label.dataset.lockedTitle) {
            label.removeAttribute('title');
            delete label.dataset.lockedTitle;
          }
        }
        if (locked) {
          node.title = LOCKED_FIELD_HINT;
        } else if (node.title === LOCKED_FIELD_HINT) {
          node.removeAttribute('title');
        }
      };

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

      const clampComboIndex = (index) => {
        if (comboState.moves.length === 0) return 0;
        return Math.min(Math.max(0, Math.trunc(index)), comboState.moves.length - 1);
      };

      const getSelectedMoveSlot = () => {
        if (!moveSelect || moveSelect.value === '') return null;
        const slot = Number(moveSelect.value);
        return Number.isFinite(slot) ? Math.max(0, Math.trunc(slot)) : null;
      };

      const readMoveFromInputs = ({ includeDerived = false } = {}) => {
        const simulation = readSelectValue(simulationSelect) || SIMULATION_ORDER[0];
        const comboDelay = simulation === 'custom' ? readNumber(comboDelayInput) : null;
        const moveSlot = getSelectedMoveSlot();
        const isCustom = !Number.isFinite(moveSlot);
        const shouldStoreMoveData = isCustom || hasMoveOverride();
        const move = {
          moveSlot,
          damage: shouldStoreMoveData ? readNumber(damageInput) : null,
          angle: shouldStoreMoveData ? readNumber(angleInput) : null,
          kbs: shouldStoreMoveData ? readNumber(kbsInput) : null,
          bkb: shouldStoreMoveData ? readNumber(bkbInput) : null,
          fkb: shouldStoreMoveData ? readNumber(fkbInput) : null,
          electric: shouldStoreMoveData ? Boolean(electricToggle && electricToggle.checked) : null,
          throwMove: shouldStoreMoveData ? Boolean(throwToggle && throwToggle.checked) : null,
          simulation,
          comboDelay,
          attackDirection: state.attackDirection,
          attackHandicap: numericValue(attackHandicapInput, 9),
          defenseHandicap: numericValue(defenseHandicapInput, 9),
        };

        if (includeDerived) {
          move.staleness = state.stalenessValue;
          move.targetState = readSelectValue(targetStateSelect) || TARGET_STATE_ORDER[0];
        }

        return move;
      };

      const syncGlobalFromUI = () => {
        const defenderOverridesActive = (defenderCustomOption && defenderSelect.value === defenderCustomOption.value)
          || hasDefenderOverride();
        comboState.global = {
          version: currentVersion,
          defender: readSelectValue(defenderSelect),
          attacker: readSelectValue(attackerSelect),
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
        if (defenderOverridesActive) {
          comboState.global.weight = readNumber(weightInput);
          comboState.global.fallAccel = readNumber(fallAccelInput);
          comboState.global.maxFall = readNumber(maxFallInput);
        }
      };

      const syncGlobalExtrasFromUI = () => {
        const global = comboState.global && typeof comboState.global === 'object' ? comboState.global : {};
        global.version = currentVersion;
        if (typeof doubleJumpArmorToggle !== 'undefined' && doubleJumpArmorToggle) {
          global.doubleJumpArmor = Boolean(doubleJumpArmorToggle.checked);
        }
        if (snapToggle) {
          global.snap = Boolean(snapToggle.checked);
        }
        global.cameraMode = trajectoryState.cameraMode;
        if (debugToggle) {
          global.debug = Boolean(debugToggle.checked);
        }
        comboState.global = global;
      };

      const applyGlobalFieldsToUI = () => {
        const global = comboState.global || {};
        if (Number.isFinite(global.hp)) hpInput.value = global.hp;
        if (Number.isFinite(global.weight)) weightInput.value = global.weight;
        if (Number.isFinite(global.fallAccel)) fallAccelInput.value = global.fallAccel;
        if (Number.isFinite(global.maxFall)) maxFallInput.value = global.maxFall;
        if (typeof global.doubleJumpArmor === 'boolean' && doubleJumpArmorToggle) {
          doubleJumpArmorToggle.checked = global.doubleJumpArmor;
        }
        if (global.position && global.position.custom && typeof global.position.x === 'number' && typeof global.position.y === 'number') {
          setCustomPositionDirect(global.position.x, global.position.y);
        } else if (global.position) {
          state.suppressPositionChange = true;
          if (typeof global.position.horizontal === 'string') {
            positionHorizontalSelect.value = global.position.horizontal;
          }
          if (typeof global.position.vertical === 'string') {
            positionVerticalSelect.value = global.position.vertical;
          }
          state.customPosition = null;
          state.suppressPositionChange = false;
          syncPositionInputs();
        }
      };

      const getMoveIdentityFromSlot = (slot, moveset) => {
        if (!Number.isFinite(slot) || !Array.isArray(moveset)) return null;
        const move = moveset[slot];
        if (!move) return null;
        const name = move.name ?? '';
        const baseName = move.baseName ?? '';
        if (!name && !baseName) return null;
        return { name, baseName };
      };

      const findMoveSlotByIdentity = (moveset, identity) => {
        if (!identity || !Array.isArray(moveset)) return null;
        if (identity.name) {
          const nameIndex = moveset.findIndex((move) => (move.name || '') === identity.name);
          if (nameIndex >= 0) return nameIndex;
        }
        if (identity.baseName) {
          const baseIndex = moveset.findIndex((move) => {
            const candidate = move.baseName || move.name || '';
            return candidate === identity.baseName;
          });
          if (baseIndex >= 0) return baseIndex;
        }
        return null;
      };

      const getMoveStaleKey = (move) => {
        const attacker = move.attacker || (comboState.global && comboState.global.attacker)
          || attackerSelect.value;
        const moveset = movesets[attacker] || currentMoves;
        if (Number.isFinite(move.moveSlot) && Array.isArray(moveset)) {
          const data = moveset[move.moveSlot];
          const baseName = data ? (data.baseName || data.name || `slot-${move.moveSlot}`) : `slot-${move.moveSlot}`;
          return `${attacker}:${baseName}`;
        }
        const customSignature = [
          move.damage, move.angle, move.kbs, move.bkb, move.fkb,
          move.electric ? 1 : 0,
          move.throwMove ? 1 : 0,
        ].map((value) => (Number.isFinite(value) ? value : 'x')).join(':');
        return `${attacker}:custom:${customSignature}`;
      };

      const buildStartPosition = (position) => {
        const pos = position || {};
        if (pos.custom && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          return { x: pos.x, y: pos.y };
        }
        const horizontal = typeof pos.horizontal === 'string' ? pos.horizontal : POSITION_HORIZONTAL_ORDER[0];
        const vertical = typeof pos.vertical === 'string' ? pos.vertical : POSITION_VERTICAL_ORDER[0];
        return computePosition(horizontal, vertical);
      };

      const ensureComboMoves = () => {
        if (comboState.moves.length === 0) {
          comboState.moves = [readMoveFromInputs({ includeDerived: true })];
        }
      };

      const syncActiveMoveFromUI = () => {
        ensureComboMoves();
        const index = clampComboIndex(comboState.activeIndex);
        const includeDerived = index === 0;
        const nextMove = readMoveFromInputs({ includeDerived });
        const currentMove = comboState.moves[index] || {};
        if (index > 0) {
          const selectedAttacker = readSelectValue(attackerSelect);
          const globalAttacker = comboState.global && comboState.global.attacker
            ? comboState.global.attacker
            : readSelectValue(attackerSelect);
          nextMove.attacker = (selectedAttacker && selectedAttacker !== globalAttacker) ? selectedAttacker : undefined;
        } else {
          nextMove.attacker = undefined;
        }
        comboState.moves[index] = { ...currentMove, ...nextMove };
        if (index === 0) {
          syncGlobalFromUI();
        } else {
          syncGlobalExtrasFromUI();
        }
      };

      const renderComboStrip = () => {
        if (!comboStrip) return;
        comboStrip.innerHTML = '';
        const totalSteps = comboState.moves.length;
        const makeArrow = () => {
          const arrow = document.createElement('span');
          arrow.className = 'combo-arrow';
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '→';
          return arrow;
        };
        comboState.moves.forEach((move, index) => {
          const wrap = document.createElement('div');
          wrap.className = 'combo-step-wrap';
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'combo-step';
          button.dataset.comboStep = String(index);
          button.textContent = String(index + 1);
          button.setAttribute('aria-label', `Select move ${index + 1}`);
          if (index === comboState.activeIndex) {
            button.classList.add('is-active');
          }
          wrap.append(button);
          if (index > 0) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'combo-remove';
            remove.dataset.comboRemove = String(index);
            remove.textContent = '×';
            remove.setAttribute('aria-label', `Remove move ${index + 1}`);
            wrap.append(remove);
          }
          comboStrip.append(wrap);
          if (index < totalSteps) {
            comboStrip.append(makeArrow());
          }
        });
        const addWrap = document.createElement('div');
        addWrap.className = 'combo-step-wrap';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'combo-step add-step';
        addButton.dataset.comboAdd = 'true';
        addButton.textContent = '+';
        addButton.setAttribute('aria-label', 'Add move');
        addWrap.append(addButton);
        comboStrip.append(addWrap);
      };

      const applyComboLocks = () => {
        const locked = comboState.activeIndex > 0;
        state.comboLockPosition = locked;
        if (comboStrip) {
          comboStrip.classList.toggle('is-locked', locked);
        }
        setLockedField(defenderSelect, locked);
        if (defenderDropdown && typeof defenderDropdown.disable === 'function') {
          locked ? defenderDropdown.disable() : defenderDropdown.enable();
        }
        [weightInput, fallAccelInput, maxFallInput, hpInput, positionXInput, positionYInput].forEach((input) => {
          setLockedField(input, locked);
        });
        setLockedField(positionHorizontalSelect, locked);
        setLockedField(positionVerticalSelect, locked);
        setLockedField(targetStateSelect, locked);
        if (doubleJumpArmorToggle) {
          doubleJumpArmorToggle.disabled = locked;
          doubleJumpArmorToggle.classList.toggle('is-locked-field', locked);
          doubleJumpArmorToggle.title = locked ? LOCKED_FIELD_HINT : '';
        }
        if (stalenessControl) {
          stalenessControl.classList.toggle('is-locked', state.comboLockStaleness);
          stalenessControl.setAttribute('aria-disabled', state.comboLockStaleness ? 'true' : 'false');
          stalenessControl.title = state.comboLockStaleness ? LOCKED_FIELD_HINT : '';
        }
        if (Array.isArray(stalenessButtons)) {
          stalenessButtons.forEach((button) => {
            button.disabled = state.comboLockStaleness;
            button.classList.toggle('is-locked-field', state.comboLockStaleness);
          });
        }
        if (trajectoryElements && trajectoryElements.svg) {
          trajectoryElements.svg.classList.toggle('is-locked', locked);
        }
      };

      const applyMoveConfigToUI = (move, { skipCalculate = false } = {}) => {
        if (!move) return;
        const previousSuppress = state.suppressComboCalculation;
        if (skipCalculate) {
          state.suppressComboCalculation = true;
        }

        const desiredAttacker = (move.attacker
          || (comboState.global && comboState.global.attacker)
          || (attackerSelect ? attackerSelect.value : null));
        if (attackerSelect && desiredAttacker && attackerSelect.value !== desiredAttacker) {
          const preferredSlot = Number.isFinite(move.moveSlot) ? move.moveSlot : null;
          setSelectValue(attackerDropdown, attackerSelect, desiredAttacker);
          const suppressMoves = state.suppressComboCalculation;
          state.suppressComboCalculation = true;
          populateMoves(desiredAttacker, { preferredSlot });
          state.suppressComboCalculation = suppressMoves;
        }

        const desiredSlot = Number.isFinite(move.moveSlot) ? String(move.moveSlot) : '';
        if (moveSelect) {
          if (desiredSlot && moveSelect.querySelector(`option[value="${desiredSlot}"]`)) {
            moveSelect.value = desiredSlot;
          } else {
            moveSelect.value = '';
          }
        }
        const option = moveSelect && moveSelect.value !== ''
          ? moveSelect.options[moveSelect.selectedIndex]
          : customOption;
        if (option) {
          applyMove(option);
        }

        if (Number.isFinite(move.damage)) damageInput.value = move.damage;
        if (Number.isFinite(move.angle)) angleInput.value = move.angle;
        if (Number.isFinite(move.kbs)) kbsInput.value = move.kbs;
        if (Number.isFinite(move.bkb)) bkbInput.value = move.bkb;
        if (Number.isFinite(move.fkb)) fkbInput.value = move.fkb;
        if (typeof move.electric === 'boolean') electricToggle.checked = move.electric;
        if (typeof move.throwMove === 'boolean') throwToggle.checked = move.throwMove;
        if (typeof move.simulation === 'string') simulationSelect.value = move.simulation;
        if (Number.isFinite(move.comboDelay)) {
          comboDelayInput.value = move.comboDelay;
        } else {
          comboDelayInput.value = '';
        }
        if (Number.isFinite(move.attackHandicap)) attackHandicapInput.value = move.attackHandicap;
        if (Number.isFinite(move.defenseHandicap)) defenseHandicapInput.value = move.defenseHandicap;
        if (typeof move.attackDirection === 'string') {
          setAttackDirection(move.attackDirection, { trigger: false });
        }

        updateComboDelayVisibility();

        state.suppressComboCalculation = previousSuppress;
      };

      const selectComboIndex = (index) => {
        const nextIndex = clampComboIndex(index);
        if (comboState.activeIndex === nextIndex) return;
        syncActiveMoveFromUI();
        comboState.activeIndex = nextIndex;
        applyMoveConfigToUI(comboState.moves[nextIndex], { skipCalculate: true });
        if (nextIndex === 0) {
          applyGlobalFieldsToUI();
          const move = comboState.moves[0] || {};
          const desiredStaleness = (typeof move.staleness === 'string')
            ? move.staleness
            : STALENESS_ORDER[0];
          setStaleness(desiredStaleness, { trigger: false });
          if (typeof move.targetState === 'string') {
            targetStateSelect.value = move.targetState;
          }
        }
        renderComboStrip();
        applyComboLocks();
        calculate();
        markStateDirty();
      };

      const addComboMove = () => {
        syncActiveMoveFromUI();
        const sourceMove = comboState.moves[comboState.activeIndex] || readMoveFromInputs({ includeDerived: comboState.activeIndex === 0 });
        const nextMove = { ...sourceMove };
        delete nextMove.staleness;
        delete nextMove.targetState;
        comboState.moves.push(nextMove);
        comboState.activeIndex = comboState.moves.length - 1;
        applyMoveConfigToUI(nextMove, { skipCalculate: true });
        renderComboStrip();
        if (comboStrip) {
          window.requestAnimationFrame(() => {
            comboStrip.scrollTo({ left: comboStrip.scrollWidth, behavior: 'smooth' });
          });
        }
        applyComboLocks();
        calculate();
        markStateDirty();
      };

      const removeComboMove = (index) => {
        if (index <= 0 || comboState.moves.length <= 1) return;
        syncActiveMoveFromUI();
        comboState.moves.splice(index, 1);
        if (comboState.activeIndex >= comboState.moves.length) {
          comboState.activeIndex = comboState.moves.length - 1;
        } else if (comboState.activeIndex > index) {
          comboState.activeIndex -= 1;
        } else if (comboState.activeIndex === index) {
          comboState.activeIndex = Math.max(0, index - 1);
        }
        applyMoveConfigToUI(comboState.moves[comboState.activeIndex], { skipCalculate: true });
        if (comboState.activeIndex === 0) {
          applyGlobalFieldsToUI();
        }
        renderComboStrip();
        applyComboLocks();
        calculate();
        markStateDirty();
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

      const doesDerivedEntryKill = (entry) => {
        if (!entry || !entry.result || !entry.startPosition) return false;
        const { result, startPosition } = entry;
        const { verticalDirection } = resolveDirections(result, Number.isFinite(entry.angle) ? entry.angle : 0);
        const signedXDistance = result.totalDistanceX;
        const signedYDistance = result.totalDistanceY * (verticalDirection === 0 ? 0 : verticalDirection);
        const finalX = startPosition.x + signedXDistance;
        const finalY = startPosition.y + signedYDistance;

        if (Array.isArray(result.trajectory) && result.trajectory.length > 0) {
          for (let i = 0; i < result.trajectory.length; i += 1) {
            const step = result.trajectory[i];
            const x = startPosition.x + step.x;
            const y = startPosition.y + step.y * (verticalDirection === 0 ? 0 : verticalDirection);
            if (isKill(x, y)) return true;
          }
        }

        return isKill(finalX, finalY);
      };

      const getFirstKillIndex = (derived) => {
        if (!Array.isArray(derived)) return null;
        for (let i = 0; i < derived.length; i += 1) {
          if (doesDerivedEntryKill(derived[i])) return i;
        }
        return null;
      };

      const updateComboSummary = ({ search }) => {
        if (!comboSummaryCard) return;
        const enabled = comboState.moves.length > 1;
        comboSummaryCard.classList.toggle('hidden', !enabled);
        if (!enabled) return;

        const derived = comboState.derived;
        if (!Array.isArray(derived) || derived.length === 0) return;
        const last = derived[derived.length - 1];
        if (!last) return;

        if (comboTotalDamageOutput) {
          const totalDamage = derived.reduce((sum, entry) => (
            sum + (Number.isFinite(entry && entry.appliedDamage) ? entry.appliedDamage : 0)
          ), 0);
          comboTotalDamageOutput.textContent = formatPercent(totalDamage);
        }

        if (comboFinalPercentOutput && Number.isFinite(last.finalPercent)) {
          comboFinalPercentOutput.textContent = formatPercent(last.finalPercent);
        } else if (comboFinalPercentOutput) {
          comboFinalPercentOutput.textContent = '—';
        }

        if (comboKillOutput) {
          const firstKillIndex = getFirstKillIndex(derived);
          if (firstKillIndex === null) {
            comboKillOutput.textContent = UI_TEXT.noKill || "Doesn't kill";
          } else {
            comboKillOutput.textContent = typeof UI_TEXT.comboKillsHit === 'function'
              ? UI_TEXT.comboKillsHit({ hit: firstKillIndex + 1 })
              : `Kills (hit ${firstKillIndex + 1})`;
          }
        }

        if (comboKillThresholdButton) {
          if (!search) {
            comboKillThresholdButton.textContent = '—';
            comboKillThresholdButton.disabled = true;
            state.comboSummaryStartToKill = null;
          } else {
            const minStart = search.findMinStartPercent((entry) => entry.firstKillIndex !== null);
            if (Number.isFinite(minStart)) {
              comboKillThresholdButton.textContent = formatPercent(minStart);
              comboKillThresholdButton.disabled = false;
              state.comboSummaryStartToKill = minStart;
            } else {
              comboKillThresholdButton.textContent = '—';
              comboKillThresholdButton.disabled = true;
              state.comboSummaryStartToKill = null;
            }
          }
        }
      };

      const makeComboSearch = ({ maxPercent = 300 } = {}) => {
        const cache = new Map();

        const evaluate = (startPercent) => {
          const key = Math.max(0, Math.trunc(startPercent));
          const cached = cache.get(key);
          if (cached) return cached;
          const derived = buildComboDerived({ startPercentOverride: key });
          const killByHit = Array.isArray(derived) ? derived.map((entry) => doesDerivedEntryKill(entry)) : [];
          const firstKillIndex = (() => {
            for (let i = 0; i < killByHit.length; i += 1) {
              if (killByHit[i]) return i;
            }
            return null;
          })();
          const summary = { startPercent: key, derived, killByHit, firstKillIndex };
          cache.set(key, summary);
          return summary;
        };

        const findMinStartPercent = (predicate) => {
          if (typeof predicate !== 'function') return null;
          if (predicate(evaluate(0))) return 0;
          if (!predicate(evaluate(maxPercent))) return null;
          let low = 0;
          let high = maxPercent;
          while (low + 1 < high) {
            const mid = Math.floor((low + high) / 2);
            if (predicate(evaluate(mid))) {
              high = mid;
            } else {
              low = mid;
            }
          }
          for (let i = 0; i < 12; i += 1) {
            if (high <= 0) break;
            if (predicate(evaluate(high - 1))) {
              high -= 1;
            } else {
              break;
            }
          }
          return high;
        };

        return { evaluate, findMinStartPercent, maxPercent };
      };

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
        const nameKey = normalizeMoveKey(move.name || '');
        if (nameKey && moveLabelMap.moves[nameKey]) {
          return moveLabelMap.moves[nameKey];
        }
        const baseName = move.baseName || move.name || '';
        const baseKey = normalizeMoveKey(baseName);
        return moveLabelMap.moves[baseKey] || null;
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
      const CHARACTER_KEYS_LEGACY = [
        'Mario', 'Fox', 'DK', 'Samus', 'Luigi', 'Link', 'Yoshi', 'Falcon', 'Kirby', 'Pikachu', 'Jigglypuff', 'Ness',
      ];
      const CHARACTER_KEYS_DISPLAY = [
        'Luigi', 'Mario', 'DK', 'Link', 'Samus', 'Falcon', 'Ness', 'Yoshi', 'Kirby', 'Fox', 'Pikachu', 'Jigglypuff',
      ];
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

      const COMBO_DATA_PREFIX = 'c:';
      const COMBO_VERSION = 2;
      const COMBO_PARAM = 'c';

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
        const index = CHARACTER_KEYS_LEGACY.indexOf(key);
        return index >= 0 ? index : CHARACTER_CUSTOM_CODE;
      };

      const getCharacterKey = (index) => {
        if (Number.isFinite(index) && index >= 0 && index < CHARACTER_KEYS_LEGACY.length) {
          return CHARACTER_KEYS_LEGACY[index];
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

      const COMBO_MOVE_BITS = {
        moveSlot: 0,
        damage: 1,
        angle: 2,
        kbs: 3,
        bkb: 4,
        fkb: 5,
        electric: 6,
        throwMove: 7,
        simulation: 8,
        comboDelay: 9,
        attackDirection: 10,
        attackHandicap: 11,
        defenseHandicap: 12,
        staleness: 13,
        targetState: 14,
        attacker: 15,
      };

      const encodeComboPayload = (payload) => {
        if (!payload || typeof payload !== 'object') return null;
        const writer = new ByteWriter();
        writer.writeVarint(COMBO_VERSION);
        writer.writeVarint(Math.max(0, Math.trunc(payload.active || 0)));

        const moves = Array.isArray(payload.moves) ? payload.moves : [];
        writer.writeVarint(moves.length);
        moves.forEach((move) => {
          let mask = 0;
          const setBit = (key) => { mask |= (1 << COMBO_MOVE_BITS[key]); };
          if (Number.isFinite(move.moveSlot)) setBit('moveSlot');
          if (Number.isFinite(move.damage)) setBit('damage');
          if (Number.isFinite(move.angle)) setBit('angle');
          if (Number.isFinite(move.kbs)) setBit('kbs');
          if (Number.isFinite(move.bkb)) setBit('bkb');
          if (Number.isFinite(move.fkb)) setBit('fkb');
          if (typeof move.electric === 'boolean') setBit('electric');
          if (typeof move.throwMove === 'boolean') setBit('throwMove');
          if (typeof move.simulation === 'string') setBit('simulation');
          if (Number.isFinite(move.comboDelay)) setBit('comboDelay');
          if (typeof move.attackDirection === 'string') setBit('attackDirection');
          if (Number.isFinite(move.attackHandicap)) setBit('attackHandicap');
          if (Number.isFinite(move.defenseHandicap)) setBit('defenseHandicap');
          if (typeof move.staleness === 'string') setBit('staleness');
          if (typeof move.targetState === 'string') setBit('targetState');
          if (typeof move.attacker === 'string') setBit('attacker');

          writer.writeVarint(mask);
          if (mask & (1 << COMBO_MOVE_BITS.moveSlot)) writer.writeVarint(Math.max(0, Math.trunc(move.moveSlot)));
          if (mask & (1 << COMBO_MOVE_BITS.damage)) writer.writeVarint(Math.round(move.damage * SCALE_DAMAGE));
          if (mask & (1 << COMBO_MOVE_BITS.angle)) writer.writeZigZag(move.angle);
          if (mask & (1 << COMBO_MOVE_BITS.kbs)) writer.writeVarint(Math.max(0, Math.trunc(move.kbs)));
          if (mask & (1 << COMBO_MOVE_BITS.bkb)) writer.writeVarint(Math.max(0, Math.trunc(move.bkb)));
          if (mask & (1 << COMBO_MOVE_BITS.fkb)) writer.writeVarint(Math.max(0, Math.trunc(move.fkb)));
          if (mask & (1 << COMBO_MOVE_BITS.electric)) writer.writeVarint(move.electric ? 1 : 0);
          if (mask & (1 << COMBO_MOVE_BITS.throwMove)) writer.writeVarint(move.throwMove ? 1 : 0);
          if (mask & (1 << COMBO_MOVE_BITS.simulation)) {
            writer.writeVarint(findIndexInList(move.simulation, SIMULATION_ORDER));
          }
          if (mask & (1 << COMBO_MOVE_BITS.comboDelay)) writer.writeVarint(Math.max(0, Math.trunc(move.comboDelay)));
          if (mask & (1 << COMBO_MOVE_BITS.attackDirection)) {
            writer.writeVarint(findIndexInList(move.attackDirection, ATTACK_DIRECTION_ORDER));
          }
          if (mask & (1 << COMBO_MOVE_BITS.attackHandicap)) writer.writeVarint(Math.max(0, Math.trunc(move.attackHandicap)));
          if (mask & (1 << COMBO_MOVE_BITS.defenseHandicap)) writer.writeVarint(Math.max(0, Math.trunc(move.defenseHandicap)));
          if (mask & (1 << COMBO_MOVE_BITS.staleness)) {
            writer.writeVarint(findIndexInList(move.staleness, STALENESS_ORDER));
          }
          if (mask & (1 << COMBO_MOVE_BITS.targetState)) {
            writer.writeVarint(findIndexInList(move.targetState, TARGET_STATE_ORDER));
          }
          if (mask & (1 << COMBO_MOVE_BITS.attacker)) {
            writer.writeVarint(getCharacterIndex(move.attacker));
          }
        });

        return encodeBytes(writer.bytes);
      };

      const decodeComboPayload = (encoded) => {
        const bytes = decodeBytes(encoded);
        if (!bytes) return null;
        try {
          const reader = new ByteReader(bytes);
          const version = reader.readVarint();
          if (version === null || version !== COMBO_VERSION) return null;
          const active = reader.readVarint() ?? 0;
          const moveCount = reader.readVarint();
          if (moveCount === null) return null;
          const moves = [];
          for (let i = 0; i < moveCount; i += 1) {
            const mask = reader.readVarint();
            if (mask === null) return null;
            const move = {};
            if (mask & (1 << COMBO_MOVE_BITS.moveSlot)) move.moveSlot = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.damage)) move.damage = reader.readVarint() / SCALE_DAMAGE;
            if (mask & (1 << COMBO_MOVE_BITS.angle)) move.angle = reader.readZigZag();
            if (mask & (1 << COMBO_MOVE_BITS.kbs)) move.kbs = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.bkb)) move.bkb = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.fkb)) move.fkb = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.electric)) move.electric = reader.readVarint() === 1;
            if (mask & (1 << COMBO_MOVE_BITS.throwMove)) move.throwMove = reader.readVarint() === 1;
            if (mask & (1 << COMBO_MOVE_BITS.simulation)) {
              const idx = reader.readVarint();
              move.simulation = SIMULATION_ORDER[idx] || SIMULATION_ORDER[0];
            }
            if (mask & (1 << COMBO_MOVE_BITS.comboDelay)) move.comboDelay = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.attackDirection)) {
              const idx = reader.readVarint();
              move.attackDirection = ATTACK_DIRECTION_ORDER[idx] || ATTACK_DIRECTION_ORDER[0];
            }
            if (mask & (1 << COMBO_MOVE_BITS.attackHandicap)) move.attackHandicap = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.defenseHandicap)) move.defenseHandicap = reader.readVarint();
            if (mask & (1 << COMBO_MOVE_BITS.staleness)) {
              const idx = reader.readVarint();
              move.staleness = STALENESS_ORDER[idx] || STALENESS_ORDER[0];
            }
            if (mask & (1 << COMBO_MOVE_BITS.targetState)) {
              const idx = reader.readVarint();
              move.targetState = TARGET_STATE_ORDER[idx] || TARGET_STATE_ORDER[0];
            }
            if (mask & (1 << COMBO_MOVE_BITS.attacker)) {
              move.attacker = getCharacterKey(reader.readVarint());
            }
            moves.push(move);
          }
          return { v: version, active, moves };
        } catch (error) {
          console.error('Failed to decode combo payload', error);
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

      const getGlobalFromSnapshot = (snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return {};
        return {
          version: snapshot.version,
          defender: snapshot.defender,
          attacker: snapshot.attacker,
          hp: snapshot.hp,
          weight: snapshot.weight,
          fallAccel: snapshot.fallAccel,
          maxFall: snapshot.maxFall,
          doubleJumpArmor: snapshot.doubleJumpArmor,
          position: snapshot.position ? { ...snapshot.position } : undefined,
          snap: snapshot.snap,
          cameraMode: snapshot.cameraMode,
          debug: snapshot.debug,
        };
      };

      const getMoveDefaults = (slot, attackerKey) => {
        const moveset = movesets[attackerKey] || currentMoves;
        if (!Number.isFinite(slot) || !Array.isArray(moveset)) return null;
        const move = moveset[slot];
        if (!move) return null;
        return {
          damage: Number(move.damage ?? 0),
          angle: Number(move.angle ?? 0),
          kbs: Number(move.kbs ?? 0),
          bkb: Number(move.bkb ?? 0),
          fkb: Number(move.fkb ?? 0),
          electric: (move.effect || '').toLowerCase() === 'electric',
          throwMove: Boolean(move.throw),
        };
      };

      const buildMoveOverrides = (move, attackerKey) => {
        if (!move) return null;
        const isCustom = !Number.isFinite(move.moveSlot);
        const defaults = isCustom ? null : getMoveDefaults(move.moveSlot, attackerKey);
        const overrides = {};
        const tolerance = 1e-4;
        const maybeSet = (key, value, fallback) => {
          if (!Number.isFinite(value)) return;
          const base = Number.isFinite(fallback) ? fallback : 0;
          if (Math.abs(value - base) > tolerance) {
            overrides[key] = value;
          }
        };

        if (isCustom) {
          maybeSet('damage', move.damage, 0);
          maybeSet('angle', move.angle, 0);
          maybeSet('kbs', move.kbs, 0);
          maybeSet('bkb', move.bkb, 0);
          maybeSet('fkb', move.fkb, 0);
          if (move.electric) overrides.electric = true;
          if (move.throwMove) overrides.throwMove = true;
        } else if (defaults) {
          maybeSet('damage', move.damage, defaults.damage);
          maybeSet('angle', move.angle, defaults.angle);
          maybeSet('kbs', move.kbs, defaults.kbs);
          maybeSet('bkb', move.bkb, defaults.bkb);
          maybeSet('fkb', move.fkb, defaults.fkb);
          if (typeof move.electric === 'boolean' && move.electric !== defaults.electric) {
            overrides.electric = move.electric;
          }
          if (typeof move.throwMove === 'boolean' && move.throwMove !== defaults.throwMove) {
            overrides.throwMove = move.throwMove;
          }
        } else {
          maybeSet('damage', move.damage, 0);
          maybeSet('angle', move.angle, 0);
          maybeSet('kbs', move.kbs, 0);
          maybeSet('bkb', move.bkb, 0);
          maybeSet('fkb', move.fkb, 0);
          if (move.electric) overrides.electric = true;
          if (move.throwMove) overrides.throwMove = true;
        }

        if (Object.keys(overrides).length === 0) return null;
        return overrides;
      };

      const buildComboBaseSnapshot = () => {
        ensureComboMoves();
        const globalState = comboState.global && typeof comboState.global === 'object'
          ? { ...comboState.global }
          : {};
        const baselineGlobal = getGlobalFromSnapshot(baselineState) || {};
        const resolveString = (key) => {
          const value = globalState[key];
          if (typeof value === 'string') return value;
          const fallback = baselineGlobal[key];
          return typeof fallback === 'string' ? fallback : undefined;
        };
        const resolveBool = (key) => {
          const value = globalState[key];
          if (typeof value === 'boolean') return value;
          const fallback = baselineGlobal[key];
          return typeof fallback === 'boolean' ? fallback : undefined;
        };
        const resolveNumber = (key) => {
          const value = globalState[key];
          if (Number.isFinite(value) || value === null) return value;
          const fallback = baselineGlobal[key];
          if (Number.isFinite(fallback) || fallback === null) return fallback;
          return undefined;
        };
        const resolvedPosition = globalState.position || baselineGlobal.position;
        const baseMove = comboState.moves[0] || {};
        const baselineAttackHandicap = Number.isFinite(baselineState?.attackHandicap) ? baselineState.attackHandicap : 9;
        const baselineDefenseHandicap = Number.isFinite(baselineState?.defenseHandicap) ? baselineState.defenseHandicap : 9;
        const snapshot = {
          version: resolveString('version') || currentVersion,
          defender: resolveString('defender'),
          attacker: resolveString('attacker'),
          moveSlot: Number.isFinite(baseMove.moveSlot) ? baseMove.moveSlot : null,
          staleness: (typeof baseMove.staleness === 'string') ? baseMove.staleness : STALENESS_ORDER[0],
          targetState: (typeof baseMove.targetState === 'string') ? baseMove.targetState : TARGET_STATE_ORDER[0],
          attackDirection: baseMove.attackDirection || ATTACK_DIRECTION_ORDER[0],
          simulation: baseMove.simulation || SIMULATION_ORDER[0],
          attackHandicap: Number.isFinite(baseMove.attackHandicap) ? baseMove.attackHandicap : baselineAttackHandicap,
          defenseHandicap: Number.isFinite(baseMove.defenseHandicap) ? baseMove.defenseHandicap : baselineDefenseHandicap,
          hp: resolveNumber('hp'),
          weight: resolveNumber('weight'),
          fallAccel: resolveNumber('fallAccel'),
          maxFall: resolveNumber('maxFall'),
          doubleJumpArmor: resolveBool('doubleJumpArmor'),
          position: resolvedPosition ? { ...resolvedPosition } : undefined,
          snap: resolveBool('snap'),
          cameraMode: resolveString('cameraMode'),
          debug: resolveBool('debug'),
        };

        if (snapshot.simulation === 'custom' && Number.isFinite(baseMove.comboDelay)) {
          snapshot.comboDelay = baseMove.comboDelay;
        }

        const moveAttacker = baseMove.attacker || globalState.attacker;
        const overrides = buildMoveOverrides(baseMove, moveAttacker);
        if (overrides) {
          Object.assign(snapshot, overrides);
        }
        return snapshot;
      };

      const buildComboPayload = () => {
        syncActiveMoveFromUI();
        const globalState = comboState.global && typeof comboState.global === 'object'
          ? { ...comboState.global }
          : {};
        const baselineGlobal = getGlobalFromSnapshot(baselineState) || {};
        if (!globalState.attacker) {
          globalState.attacker = baselineGlobal.attacker;
        }
        const defaultAttackHandicap = Number.isFinite(baselineState?.attackHandicap) ? baselineState.attackHandicap : 9;
        const defaultDefenseHandicap = Number.isFinite(baselineState?.defenseHandicap) ? baselineState.defenseHandicap : 9;
        const tolerance = 1e-4;
        const moves = comboState.moves.slice(1).map((move) => {
          const moveAttacker = move.attacker || globalState.attacker;
          const payload = {};
          if (Number.isFinite(move.moveSlot)) {
            payload.moveSlot = move.moveSlot;
          }
          const isCustom = !Number.isFinite(move.moveSlot);
          const defaults = isCustom ? null : getMoveDefaults(move.moveSlot, moveAttacker);
          const defaultValue = (value, fallback) => (Number.isFinite(value) ? value : fallback);

          const maybeSet = (key, value, fallback) => {
            if (!Number.isFinite(value)) return;
            const base = Number.isFinite(fallback) ? fallback : 0;
            if (Math.abs(value - base) > tolerance) {
              payload[key] = value;
            }
          };

          if (isCustom) {
            maybeSet('damage', move.damage, 0);
            maybeSet('angle', move.angle, 0);
            maybeSet('kbs', move.kbs, 0);
            maybeSet('bkb', move.bkb, 0);
            maybeSet('fkb', move.fkb, 0);
            if (move.electric) payload.electric = true;
            if (move.throwMove) payload.throwMove = true;
          } else if (defaults) {
            maybeSet('damage', move.damage, defaults.damage);
            maybeSet('angle', move.angle, defaults.angle);
            maybeSet('kbs', move.kbs, defaults.kbs);
            maybeSet('bkb', move.bkb, defaults.bkb);
            maybeSet('fkb', move.fkb, defaults.fkb);
            if (typeof move.electric === 'boolean' && move.electric !== defaults.electric) {
              payload.electric = move.electric;
            }
            if (typeof move.throwMove === 'boolean' && move.throwMove !== defaults.throwMove) {
              payload.throwMove = move.throwMove;
            }
          } else {
            maybeSet('damage', move.damage, 0);
            maybeSet('angle', move.angle, 0);
            maybeSet('kbs', move.kbs, 0);
            maybeSet('bkb', move.bkb, 0);
            maybeSet('fkb', move.fkb, 0);
            if (move.electric) payload.electric = true;
            if (move.throwMove) payload.throwMove = true;
          }

          const simulation = move.simulation || SIMULATION_ORDER[0];
          if (simulation !== SIMULATION_ORDER[0] || Number.isFinite(move.comboDelay)) {
            payload.simulation = simulation;
          }
          if (simulation === 'custom' && Number.isFinite(move.comboDelay)) {
            payload.comboDelay = move.comboDelay;
          }
          if (move.attackDirection && move.attackDirection !== ATTACK_DIRECTION_ORDER[0]) {
            payload.attackDirection = move.attackDirection;
          }
          if (Number.isFinite(move.attackHandicap) && move.attackHandicap !== defaultAttackHandicap) {
            payload.attackHandicap = move.attackHandicap;
          }
          if (Number.isFinite(move.defenseHandicap) && move.defenseHandicap !== defaultDefenseHandicap) {
            payload.defenseHandicap = move.defenseHandicap;
          }
          if (move.staleness && move.staleness !== STALENESS_ORDER[0]) {
            payload.staleness = move.staleness;
          }
          if (move.attacker && move.attacker !== globalState.attacker) {
            payload.attacker = move.attacker;
          }
          return payload;
        });
        return {
          v: COMBO_VERSION,
          active: clampComboIndex(comboState.activeIndex),
          moves,
        };
      };

      const getEncodedDataParam = () => {
        if (comboState.moves.length > 1) {
          const snapshot = buildComboBaseSnapshot();
          const delta = buildStateDelta(snapshot, baselineState);
          if (!delta) return null;
          return encodeState(delta) || null;
        }
        const snapshot = buildStateSnapshot();
        const delta = buildStateDelta(snapshot, baselineState);
        if (!delta) return null;
        const encoded = encodeState(delta);
        return encoded || null;
      };

      const getEncodedComboParam = () => {
        if (comboState.moves.length <= 1) return null;
        const payload = buildComboPayload();
        const encoded = encodeComboPayload(payload);
        return encoded || null;
      };

      const updateUrlFromState = () => {
        if (suppressUrlSync) return;
        const url = new URL(window.location.href);
        const encoded = getEncodedDataParam();
        const encodedCombo = getEncodedComboParam();
        if (encoded) {
          url.searchParams.set('data', encoded);
        } else {
          url.searchParams.delete('data');
        }
        if (encodedCombo) {
          url.searchParams.set(COMBO_PARAM, encodedCombo);
        } else {
          url.searchParams.delete(COMBO_PARAM);
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
        const encoded = getEncodedDataParam();
        const encodedCombo = getEncodedComboParam();
        if (encoded) {
          url.searchParams.set('data', encoded);
        } else {
          url.searchParams.delete('data');
        }
        if (encodedCombo) {
          url.searchParams.set(COMBO_PARAM, encodedCombo);
        } else {
          url.searchParams.delete(COMBO_PARAM);
        }
        if (replace) {
          window.location.replace(url.toString());
        } else {
          window.location.assign(url.toString());
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const dataParam = urlParams.get('data');
      const comboParam = urlParams.get(COMBO_PARAM);
      const langParam = urlParams.get('lang');
      hadDataParam = Boolean(dataParam || comboParam);
      let initialComboState = null;
      if (dataParam) {
        if (!dataParam.startsWith(COMBO_DATA_PREFIX)) {
          initialDataState = decodeState(dataParam);
        }
      }
      if (comboParam) {
        initialComboState = decodeComboPayload(comboParam);
      }

      const normalizedLangParam = langParam ? normalizeLanguage(langParam) : null;
      if (normalizedLangParam && normalizedLangParam !== currentLanguage) {
        const targetPath = LANGUAGE_PATHS[normalizedLangParam] || LANGUAGE_PATHS.en;
        const url = new URL(targetPath, window.location.origin);
        if (dataParam) {
          url.searchParams.set('data', dataParam);
        }
        if (comboParam) {
          url.searchParams.set(COMBO_PARAM, comboParam);
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
        const previousMoveset = !initial && Array.isArray(currentMoves) ? [...currentMoves] : [];
        const previousMovesets = !initial ? movesets : null;
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

        const globalAttackerKey = comboState.global && comboState.global.attacker
          ? comboState.global.attacker
          : attackerSelect.value;
        const identities = comboState.moves.map((move) => {
          const attackerKey = move.attacker || globalAttackerKey;
          const oldMoveset = previousMovesets && previousMovesets[attackerKey]
            ? previousMovesets[attackerKey]
            : previousMoveset;
          return getMoveIdentityFromSlot(move.moveSlot, oldMoveset);
        });
        const preferredIdentity = identities[comboState.activeIndex];
        const preferredMove = (preferredIdentity && (preferredIdentity.name || preferredIdentity.baseName))
          || lastMoveBaseName
          || (selectedMoveData ? (selectedMoveData.name || selectedMoveData.baseName || null) : null);
        setDefender(defenderSelect.value);
        updateDoubleJumpArmorVisibility({ skipCalculate: true });
        const previousSuppress = state.suppressComboCalculation;
        state.suppressComboCalculation = true;
        populateMoves(attackerSelect.value, { preferredMove });
        state.suppressComboCalculation = previousSuppress;

        comboState.moves = comboState.moves.map((move, index) => {
          if (!Number.isFinite(move.moveSlot)) return move;
          const identity = identities[index];
          if (!identity) return move;
          const attackerKey = move.attacker || globalAttackerKey;
          const nextMoveset = movesets[attackerKey] || currentMoves;
          const remappedSlot = findMoveSlotByIdentity(nextMoveset, identity);
          if (!Number.isFinite(remappedSlot)) return move;
          return { ...move, moveSlot: remappedSlot };
        });
        applyMoveConfigToUI(comboState.moves[comboState.activeIndex], { skipCalculate: true });
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

      const CHARACTER_NAME_OVERRIDES = {
        Jigglypuff: { ja: 'Purin' },
      };

      const getCharacterDisplayName = (character) => {
        const override = CHARACTER_NAME_OVERRIDES[character.key];
        if (override && currentLanguage === 'ja' && override.ja) {
          return override.ja;
        }
        return character.name;
      };

      const characterMap = Smash64Calculator.characters.reduce((acc, character) => {
        acc[character.key] = character;
        return acc;
      }, {});

      CHARACTER_KEYS_DISPLAY.forEach((key) => {
        const character = characterMap[key];
        if (!character) return;
        const displayName = getCharacterDisplayName(character);
        const optionMarkup = getCharacterOptionMarkup(character, displayName);
        const defenderOption = document.createElement('option');
        defenderOption.value = character.key;
        defenderOption.textContent = displayName;
        if (optionMarkup) {
          defenderOption.dataset.html = optionMarkup;
        }
        defenderSelect.append(defenderOption);

        const attackerOption = document.createElement('option');
        attackerOption.value = character.key;
        attackerOption.textContent = displayName;
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
          settings: { showSearch: false, keepOrder: true }
        });
        defenderDropdown = new SlimSelect({
          select: defenderSelect,
          settings: { showSearch: false, keepOrder: true }
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

      async function applyGlobalState(globalState) {
        const targetVersion = globalState.version ? normalizeVersion(globalState.version) : currentVersion;
        await applyGameVersion(targetVersion, { initial: true });
        if (versionSelect) {
          versionSelect.value = targetVersion;
        }

        if (globalState.defender) {
          setSelectValue(defenderDropdown, defenderSelect, globalState.defender);
          setDefender(globalState.defender);
        }

        if (globalState.attacker) {
          setSelectValue(attackerDropdown, attackerSelect, globalState.attacker);
        }

        if (typeof globalState.hp === 'number') hpInput.value = globalState.hp;
        if (typeof globalState.weight === 'number') weightInput.value = globalState.weight;
        if (typeof globalState.fallAccel === 'number') fallAccelInput.value = globalState.fallAccel;
        if (typeof globalState.maxFall === 'number') maxFallInput.value = globalState.maxFall;

        if (globalState.position && globalState.position.custom && typeof globalState.position.x === 'number' && typeof globalState.position.y === 'number') {
          setCustomPositionDirect(globalState.position.x, globalState.position.y);
        } else if (globalState.position) {
          state.suppressPositionChange = true;
          if (typeof globalState.position.horizontal === 'string') {
            positionHorizontalSelect.value = globalState.position.horizontal;
          }
          if (typeof globalState.position.vertical === 'string') {
            positionVerticalSelect.value = globalState.position.vertical;
          }
          state.customPosition = null;
          state.suppressPositionChange = false;
          syncPositionInputs();
        }

        if (typeof globalState.snap === 'boolean' && snapToggle) {
          snapToggle.checked = globalState.snap;
          trajectoryState.snapEnabled = globalState.snap;
        }

        if (typeof globalState.cameraMode === 'string') {
          setCameraMode(globalState.cameraMode, { trigger: false });
        }

        if (typeof globalState.doubleJumpArmor === 'boolean' && doubleJumpArmorToggle) {
          doubleJumpArmorToggle.checked = globalState.doubleJumpArmor;
        }

        if (typeof globalState.debug === 'boolean' && debugToggle) {
          debugToggle.checked = globalState.debug;
          debugMode = globalState.debug;
        }

        maybeMarkDefenderCustom();
        updateDoubleJumpArmorVisibility({ skipCalculate: true });
      }

      const sanitizeComboMove = (move = {}, index = 0) => {
        const hasSlot = Number.isFinite(move.moveSlot);
        const sanitized = {
          attacker: typeof move.attacker === 'string' ? move.attacker : undefined,
          moveSlot: hasSlot ? Math.max(0, Math.trunc(move.moveSlot)) : null,
          damage: Number.isFinite(move.damage) ? move.damage : (hasSlot ? null : 0),
          angle: Number.isFinite(move.angle) ? move.angle : (hasSlot ? null : 0),
          kbs: Number.isFinite(move.kbs) ? move.kbs : (hasSlot ? null : 0),
          bkb: Number.isFinite(move.bkb) ? move.bkb : (hasSlot ? null : 0),
          fkb: Number.isFinite(move.fkb) ? move.fkb : (hasSlot ? null : 0),
          electric: (typeof move.electric === 'boolean') ? move.electric : (hasSlot ? undefined : false),
          throwMove: (typeof move.throwMove === 'boolean') ? move.throwMove : (hasSlot ? undefined : false),
          simulation: SIMULATION_ORDER.includes(move.simulation) ? move.simulation : SIMULATION_ORDER[0],
          comboDelay: Number.isFinite(move.comboDelay) ? move.comboDelay : null,
          attackDirection: ATTACK_DIRECTION_ORDER.includes(move.attackDirection) ? move.attackDirection : ATTACK_DIRECTION_ORDER[0],
          attackHandicap: Number.isFinite(move.attackHandicap) ? move.attackHandicap : numericValue(attackHandicapInput, 9),
          defenseHandicap: Number.isFinite(move.defenseHandicap) ? move.defenseHandicap : numericValue(defenseHandicapInput, 9),
        };
        const stalenessValue = STALENESS_ORDER.includes(move.staleness)
          ? move.staleness
          : (index === 0 ? STALENESS_ORDER[0] : undefined);
        if (stalenessValue !== undefined) {
          sanitized.staleness = stalenessValue;
        }
        if (index === 0) {
          sanitized.targetState = TARGET_STATE_ORDER.includes(move.targetState) ? move.targetState : TARGET_STATE_ORDER[0];
        }
        return sanitized;
      };

      async function applyComboPayload(payload) {
        if (!payload || typeof payload !== 'object') return;
        suppressUrlSync = true;
        state.suppressComboCalculation = true;
        ensureComboMoves();
        const baseMove = readMoveFromInputs({ includeDerived: true });
        const rawMoves = Array.isArray(payload.moves) ? payload.moves : [];
        const extraMoves = rawMoves.map((move, index) => sanitizeComboMove(move, index + 1));
        comboState.moves = [baseMove, ...extraMoves];
        comboState.activeIndex = clampComboIndex(payload.active ?? 0);
        syncGlobalFromUI();

        const activeMove = comboState.moves[comboState.activeIndex];
        const preferredSlot = Number.isFinite(activeMove.moveSlot) ? activeMove.moveSlot : null;
        const activeAttacker = activeMove.attacker || comboState.global.attacker || attackerSelect.value;
        populateMoves(activeAttacker, { preferredSlot });
        applyMoveConfigToUI(activeMove, { skipCalculate: true });

        renderComboStrip();
        applyComboLocks();

        state.suppressComboCalculation = false;
        calculate();

        stateDirty = false;
        suppressUrlSync = false;
      }

      async function applyStateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;
        const previousSuppress = state.suppressComboCalculation;
        state.suppressComboCalculation = true;
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

        comboState.activeIndex = 0;
        comboState.moves = [readMoveFromInputs({ includeDerived: true })];
        syncGlobalFromUI();
        renderComboStrip();
        applyComboLocks();

        state.suppressComboCalculation = previousSuppress;
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

      const resolveDirections = (result, angleValue) => {
        const resolvedAngleDeg = typeof result.resolvedAngle === 'number' ? result.resolvedAngle : angleValue;
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
        return { resolvedAngleDeg, horizontalDirection, verticalDirection };
      };

      const computeMoveOutcome = (params) => {
        const result = Smash64Calculator.compute(params);
        const { resolvedAngleDeg, verticalDirection } = resolveDirections(result, params.angle);
        const signedXDistance = result.totalDistanceX;
        const signedYDistance = result.totalDistanceY * (verticalDirection === 0 ? 0 : verticalDirection);
        const finalPosition = {
          x: params.startX + signedXDistance,
          y: params.startY + signedYDistance,
        };
        const staledDamage = Smash64Calculator.applyStaleness(params.baseDamage, params.damageModifier);
        const appliedDamage = params.targetState === 'laying' ? Math.ceil(staledDamage / 2) : staledDamage;
        const finalPercent = Math.max(0, Number(params.hp) || 0) + appliedDamage;
        return {
          result,
          resolvedAngleDeg,
          verticalDirection,
          signedXDistance,
          signedYDistance,
          finalPosition,
          staledDamage,
          appliedDamage,
          finalPercent,
        };
      };

      const buildComboDerived = ({ startPercentOverride = null } = {}) => {
        ensureComboMoves();
        const global = comboState.global || {};
        const startPosition = buildStartPosition(global.position);
        const startPercent = Number.isFinite(startPercentOverride)
          ? startPercentOverride
          : (Number.isFinite(global.hp) ? global.hp : numericValue(hpInput, 0));
        const defenderTraction = Number.isFinite(selectedDefenderTraction)
          ? selectedDefenderTraction
          : (selectedDefenderData && Number.isFinite(selectedDefenderData.traction)
            ? selectedDefenderData.traction
            : 1);
        const baseGroundPlanes = Object.values(POSITION_DATA).reduce((planes, platform) => {
          if (!platform) return planes;
          const xMin = platform.center - platform.halfWidth;
          const xMax = platform.center + platform.halfWidth;
          planes.push({ xMin, xMax, y: platform.y });
          return planes;
        }, []);
        const yoshiSelected = isYoshiDefender();
        const doubleJumpArmorActive = yoshiSelected && doubleJumpArmorToggle && doubleJumpArmorToggle.checked;

        let currentPercent = startPercent;
        let currentPosition = { ...startPosition };
        let currentTargetState = comboState.moves[0].targetState || TARGET_STATE_ORDER[0];
        const stalenessLevels = new Map();
        const derived = [];

        comboState.moves.forEach((move, index) => {
          const moveAttacker = move.attacker || global.attacker;
          const moveDefaults = Number.isFinite(move.moveSlot)
            ? getMoveDefaults(move.moveSlot, moveAttacker)
            : null;
          const stalenessKey = getMoveStaleKey(move);
          const previousLevel = stalenessLevels.get(stalenessKey) || 0;
          const manualStaleness = STALENESS_ORDER.includes(move.staleness)
            ? move.staleness
            : STALENESS_ORDER[0];
          const forcedIndex = Math.min(previousLevel, STALENESS_ORDER.length - 1);
          const stalenessForced = forcedIndex > 0;
          const stalenessValue = stalenessForced
            ? STALENESS_ORDER[forcedIndex]
            : manualStaleness;

          const simulationMode = move.simulation || SIMULATION_ORDER[0];
          const rawComboDelay = Number.isFinite(move.comboDelay) ? move.comboDelay : 0;
          const comboDelayValue = Math.max(0, Math.trunc(rawComboDelay));
          const comboDelayFrames = simulationMode === 'custom' ? comboDelayValue + 1 : 0;

          const baseDamage = Number.isFinite(move.damage)
            ? move.damage
            : (moveDefaults ? moveDefaults.damage : 0);
          const baseAngle = Number.isFinite(move.angle)
            ? move.angle
            : (moveDefaults ? moveDefaults.angle : 0);
          const baseKbs = Number.isFinite(move.kbs)
            ? move.kbs
            : (moveDefaults ? moveDefaults.kbs : 0);
          const baseBkb = Number.isFinite(move.bkb)
            ? move.bkb
            : (moveDefaults ? moveDefaults.bkb : 0);
          const baseFkb = Number.isFinite(move.fkb)
            ? move.fkb
            : (moveDefaults ? moveDefaults.fkb : 0);
          const baseElectric = (typeof move.electric === 'boolean')
            ? move.electric
            : (moveDefaults ? moveDefaults.electric : false);
          const baseThrow = (typeof move.throwMove === 'boolean')
            ? move.throwMove
            : (moveDefaults ? moveDefaults.throwMove : false);

          const attackDirection = move.attackDirection || ATTACK_DIRECTION_ORDER[0];
          const groundPlanes = baseGroundPlanes;
          const params = {
            weight: Number.isFinite(global.weight) ? global.weight : numericValue(weightInput, 1),
            fallAccel: Number.isFinite(global.fallAccel) ? global.fallAccel : numericValue(fallAccelInput, 0),
            maxFall: Number.isFinite(global.maxFall) ? global.maxFall : numericValue(maxFallInput, 0),
            hp: currentPercent,
            baseDamage,
            baseKnockback: baseBkb,
            knockbackScaling: baseKbs,
            fixedKnockback: baseFkb,
            angle: baseAngle,
            attackHandicapIndex: Math.min(40, Math.max(0, Math.trunc(
              Number.isFinite(move.attackHandicap) ? move.attackHandicap : numericValue(attackHandicapInput, 9)
            ))),
            defenseHandicapIndex: Math.min(40, Math.max(0, Math.trunc(
              Number.isFinite(move.defenseHandicap) ? move.defenseHandicap : numericValue(defenseHandicapInput, 9)
            ))),
            damageModifier: stalenessValue,
            targetState: currentTargetState,
            electric: baseElectric,
            throwMove: baseThrow,
            doubleJumpArmor: doubleJumpArmorActive,
            attackDirection,
            simulationMode,
            comboDelay: comboDelayFrames,
            startX: currentPosition.x,
            startY: currentPosition.y,
            traction: defenderTraction,
            groundPlanes,
          };

          const outcome = computeMoveOutcome(params);
          const endPosition = outcome.finalPosition;

          derived[index] = {
            startPercent: currentPercent,
            startPosition: { ...currentPosition },
            targetState: currentTargetState,
            stalenessValue,
            stalenessForced,
            angle: baseAngle,
            endPosition,
            finalPercent: outcome.finalPercent,
            appliedDamage: outcome.appliedDamage,
            result: outcome.result,
          };

          stalenessLevels.forEach((value, key) => {
            if (key === stalenessKey) return;
            if (value > 0) {
              stalenessLevels.set(key, value - 1);
            }
          });
          stalenessLevels.set(stalenessKey, STALENESS_ORDER.length - 1);

          currentPercent = outcome.finalPercent;
          currentPosition = endPosition;
          const grounded = typeof isPositionOnPlatform === 'function'
            ? isPositionOnPlatform(endPosition)
            : false;
          if (grounded) {
            currentTargetState = outcome.result.hitstun >= 32 ? 'laying' : 'standing';
          } else {
            currentTargetState = 'airborne';
          }
        });

        return derived;
      };

      const computeComboDerived = () => {
        comboState.derived = buildComboDerived();
      };

      const applyActiveDerivedFields = () => {
        if (comboState.activeIndex === 0) {
          state.comboLockStaleness = false;
          const move = comboState.moves[0] || {};
          const derived = comboState.derived[0];
          if (move && typeof move.targetState === 'string') {
            targetStateSelect.value = move.targetState;
          }
          const desiredStaleness = (typeof move.staleness === 'string')
            ? move.staleness
            : (derived && typeof derived.stalenessValue === 'string'
              ? derived.stalenessValue
              : STALENESS_ORDER[0]);
          if (typeof desiredStaleness === 'string') {
            setStaleness(desiredStaleness, { trigger: false });
            if (typeof move.staleness !== 'string') {
              comboState.moves[0] = { ...move, staleness: desiredStaleness };
            }
          }
          return;
        }
        const derived = comboState.derived[comboState.activeIndex];
        if (!derived) return;
        state.comboLockStaleness = Boolean(derived.stalenessForced);
        if (Number.isFinite(derived.startPercent)) {
          hpInput.value = derived.startPercent;
        }
        if (derived.startPosition && typeof setCustomPositionDirect === 'function') {
          setCustomPositionDirect(derived.startPosition.x, derived.startPosition.y);
        }
        if (typeof derived.targetState === 'string') {
          targetStateSelect.value = derived.targetState;
          if (derived.targetState !== 'airborne') {
            state.lastGroundState = derived.targetState;
            state.autoAirborneActive = false;
          } else {
            state.autoAirborneActive = true;
          }
        }
        if (typeof derived.stalenessValue === 'string') {
          setStaleness(derived.stalenessValue, { trigger: false });
        }
      };

      function calculateOutput() {
        const attackIndex = Math.min(40, Math.max(0, Math.trunc(numericValue(attackHandicapInput, 9))));
        const defenseIndex = Math.min(40, Math.max(0, Math.trunc(numericValue(defenseHandicapInput, 9))));

        const simulationMode = simulationSelect.value;
        const attackDirection = state.attackDirection || 'right';
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
        const baseGroundPlanes = Object.values(POSITION_DATA).reduce((planes, platform) => {
          if (!platform) return planes;
          const xMin = platform.center - platform.halfWidth;
          const xMax = platform.center + platform.halfWidth;
          planes.push({ xMin, xMax, y: platform.y });
          return planes;
        }, []);

        const yoshiSelected = isYoshiDefender();
        const doubleJumpArmorActive = yoshiSelected && doubleJumpArmorToggle && doubleJumpArmorToggle.checked;

        const baseAngle = numericValue(angleInput, 0);
        const groundPlanes = baseGroundPlanes;
        const params = {
          weight: numericValue(weightInput, 1),
          fallAccel: numericValue(fallAccelInput, 0),
          maxFall: numericValue(maxFallInput, 0),
          hp: numericValue(hpInput, 0),
          baseDamage: numericValue(damageInput, 0),
          baseKnockback: numericValue(bkbInput, 0),
          knockbackScaling: numericValue(kbsInput, 0),
          fixedKnockback: numericValue(fkbInput, 0),
          angle: baseAngle,
          attackHandicapIndex: attackIndex,
          defenseHandicapIndex: defenseIndex,
          damageModifier: state.stalenessValue,
          targetState: targetStateSelect.value,
          electric: electricToggle.checked,
          throwMove: throwToggle.checked,
          doubleJumpArmor: doubleJumpArmorActive,
          attackDirection,
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
        outputNodes.finalPercent.textContent = formatPercent(appliedDamage);

        const finalPercent = startPercent + appliedDamage;
        const comboActive = comboState.moves.length > 1 && Array.isArray(comboState.derived) && comboState.derived.length > 0;
        const activeIndex = clampComboIndex(comboState.activeIndex);
        const activeDerived = comboActive ? comboState.derived[activeIndex] : null;

        const totalAfterHit = (activeDerived && Number.isFinite(activeDerived.finalPercent))
          ? activeDerived.finalPercent
          : finalPercent;
        const breakdown = (activeDerived && Number.isFinite(activeDerived.startPercent) && Number.isFinite(activeDerived.appliedDamage))
          ? `${formatPercent(activeDerived.startPercent)} + ${formatPercent(activeDerived.appliedDamage)}`
          : `${formatPercent(startPercent)} + ${formatPercent(appliedDamage)}`;
        const breakdownText = typeof UI_TEXT.totalDamageBreakdown === 'function'
          ? UI_TEXT.totalDamageBreakdown({ total: formatIntegral(totalAfterHit), breakdown })
          : `Total: ${formatPercent(totalAfterHit)} (${breakdown})`;
        const stalenessLabel = (activeDerived && typeof activeDerived.stalenessValue === 'string')
          ? activeDerived.stalenessValue
          : state.stalenessValue;
        outputNodes.percentBreakdown.textContent = (stalenessLabel !== 'fresh' && typeof UI_TEXT.afterStaleness === 'function')
          ? UI_TEXT.afterStaleness({ summary: breakdownText })
          : breakdownText;

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

        const { verticalDirection } = resolveDirections(result, params.angle);

        const signedInitialVX = result.initialVelocityX;
        const signedInitialVY = result.initialVelocityY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.initVx.textContent = formatStandard(signedInitialVX);
        outputNodes.initVy.textContent = formatStandard(signedInitialVY);

        const signedXDistance = result.totalDistanceX;
        const signedYDistance = result.totalDistanceY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.totalX.textContent = formatStandard(signedXDistance);
        outputNodes.totalY.textContent = formatStandard(signedYDistance);
        const finalX = position.x + signedXDistance;
        const finalY = position.y + signedYDistance;
        outputNodes.finalPosition.textContent = `(${formatIntegral(finalX)}, ${formatIntegral(finalY)})`;

        const trajectoryDirectionX = 1;
        const trajectoryDirectionY = verticalDirection === 0 ? 0 : verticalDirection;
        const trajectoryPoints = (result.trajectory || []).map((step) => ({
          frame: step.frame,
          x: position.x + step.x * trajectoryDirectionX,
          y: position.y + step.y * trajectoryDirectionY,
        }));
        if (trajectoryPoints.length === 0) {
          trajectoryPoints.push({ frame: 0, x: position.x, y: position.y });
        }
        const secondaryTrajectories = [];
        if (comboState.moves.length > 1 && Array.isArray(comboState.derived)) {
          comboState.derived.forEach((entry, index) => {
            if (!entry || index === comboState.activeIndex) return;
            const move = comboState.moves[index] || {};
            if (!entry.result || !entry.startPosition || !entry.endPosition) return;
            const { verticalDirection: secondaryVert } = resolveDirections(
              entry.result,
              Number.isFinite(move.angle) ? move.angle : 0
            );
            const secondaryDirectionX = 1;
            const secondaryDirectionY = secondaryVert === 0 ? 0 : secondaryVert;
            const secondaryPoints = (entry.result.trajectory || []).map((step) => ({
              frame: step.frame,
              x: entry.startPosition.x + step.x * secondaryDirectionX,
              y: entry.startPosition.y + step.y * secondaryDirectionY,
            }));
            if (secondaryPoints.length === 0) {
              secondaryPoints.push({
                frame: 0,
                x: entry.startPosition.x,
                y: entry.startPosition.y,
              });
            }
            const secondaryHitstun = Math.max(
              0,
              Number.isFinite(entry.result.simulatedHitstun) ? entry.result.simulatedHitstun : entry.result.hitstun
            );
            secondaryTrajectories.push({
              startPosition: entry.startPosition,
              trajectoryPoints: secondaryPoints,
              finalPosition: entry.endPosition,
              hitstunFrames: secondaryHitstun,
              label: index + 1,
            });
          });
        }

        updateTrajectoryDisplay(position, trajectoryPoints, { x: finalX, y: finalY }, displayHitstun, {
          killFrameLimit: customFrameLimit,
          allowEndPointWhenKill: customFrameLimit !== null,
          secondaryTrajectories,
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
          const fallbackSimVertical = (() => {
            if (!Number.isFinite(simAngleRad)) return Math.abs(sim.initialVelocityY) < 1e-6 ? 0 : 1;
            const sinValue = Math.sin(simAngleRad);
            if (Math.abs(sinValue) < 1e-6) return 0;
            return sinValue > 0 ? 1 : -1;
          })();
          const simVerticalDirection = (typeof sim.verticalDirection === 'number')
            ? sim.verticalDirection
            : fallbackSimVertical;
          const simSignedX = sim.totalDistanceX;
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
                + step.x;
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

        const comboSearch = comboState.moves.length > 1
          ? makeComboSearch({ maxPercent: thresholdMaxPercent })
          : null;
        updateComboSummary({ search: comboSearch });

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
      function calculate() {
        if (state.suppressComboCalculation) return;
        syncActiveMoveFromUI();
        computeComboDerived();
        applyActiveDerivedFields();
        applyComboLocks();
        calculateOutput();
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
        syncActiveMoveFromUI();
        const selectedAttacker = attackerSelect.value;
        if (comboState.activeIndex > 0) {
          const previousMoveset = Array.isArray(currentMoves) ? [...currentMoves] : [];
          const activeMove = comboState.moves[comboState.activeIndex] || {};
          const identity = getMoveIdentityFromSlot(activeMove.moveSlot, previousMoveset);
          const preferredMove = (identity && (identity.name || identity.baseName))
            || lastMoveBaseName
            || (selectedMoveData ? (selectedMoveData.name || selectedMoveData.baseName || null) : null);
          const previousSuppress = state.suppressComboCalculation;
          state.suppressComboCalculation = true;
          populateMoves(selectedAttacker, { preferredMove });
          state.suppressComboCalculation = previousSuppress;

          if (identity) {
            const remappedSlot = findMoveSlotByIdentity(currentMoves, identity);
            if (Number.isFinite(remappedSlot)) {
              activeMove.moveSlot = remappedSlot;
            }
          }
          const globalAttacker = comboState.global && comboState.global.attacker
            ? comboState.global.attacker
            : selectedAttacker;
          activeMove.attacker = (selectedAttacker && selectedAttacker !== globalAttacker) ? selectedAttacker : undefined;
          comboState.moves[comboState.activeIndex] = { ...comboState.moves[comboState.activeIndex], ...activeMove };
          applyMoveConfigToUI(comboState.moves[comboState.activeIndex], { skipCalculate: true });
          calculate();
          markStateDirty();
          return;
        }

        const previousMoveset = Array.isArray(currentMoves) ? [...currentMoves] : [];
        const identities = comboState.moves.map((move) => (
          move.attacker ? null : getMoveIdentityFromSlot(move.moveSlot, previousMoveset)
        ));
        const preferredIdentity = identities[comboState.activeIndex];
        const preferredMove = (preferredIdentity && (preferredIdentity.name || preferredIdentity.baseName))
          || lastMoveBaseName
          || (selectedMoveData ? (selectedMoveData.name || selectedMoveData.baseName || null) : null);
        const previousSuppress = state.suppressComboCalculation;
        state.suppressComboCalculation = true;
        populateMoves(selectedAttacker, { preferredMove });
        state.suppressComboCalculation = previousSuppress;

        comboState.moves = comboState.moves.map((move, index) => {
          if (move.attacker) {
            if (move.attacker === selectedAttacker) {
              const { attacker, ...rest } = move;
              return rest;
            }
            return move;
          }
          if (!Number.isFinite(move.moveSlot)) return move;
          const identity = identities[index];
          if (!identity) return move;
          const remappedSlot = findMoveSlotByIdentity(currentMoves, identity);
          if (!Number.isFinite(remappedSlot)) return move;
          return { ...move, moveSlot: remappedSlot };
        });

        applyMoveConfigToUI(comboState.moves[comboState.activeIndex], { skipCalculate: true });
        calculate();
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
          if (comboState.activeIndex > 0) return;
          enforceDoubleJumpArmorState({ forceCalculate: true });
          markStateDirty();
        });
      }

      targetStateSelect.addEventListener('change', () => {
        if (comboState.activeIndex > 0) return;
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
          if (state.comboLockPosition) return;
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
          if (state.comboLockPosition) return;
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
        if (state.comboLockPosition) return;
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
        if (state.comboLockPosition) return;
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
          if (state.comboLockStaleness) return;
          const value = button.dataset.staleness;
          if (!value) return;
          if (comboState.activeIndex > 0) {
            const move = comboState.moves[comboState.activeIndex] || {};
            comboState.moves[comboState.activeIndex] = { ...move, staleness: value };
          }
          setStaleness(value);
          markStateDirty();
        });
      });

      if (comboStrip) {
        comboStrip.addEventListener('click', (event) => {
          const removeButton = event.target.closest('[data-combo-remove]');
          if (removeButton) {
            event.preventDefault();
            const index = Number(removeButton.dataset.comboRemove);
            if (Number.isFinite(index)) {
              removeComboMove(index);
            }
            return;
          }
          const addButton = event.target.closest('[data-combo-add]');
          if (addButton) {
            event.preventDefault();
            addComboMove();
            return;
          }
          const stepButton = event.target.closest('[data-combo-step]');
          if (stepButton) {
            event.preventDefault();
            const index = Number(stepButton.dataset.comboStep);
            if (Number.isFinite(index)) {
              selectComboIndex(index);
            }
          }
        });
      }

      if (comboKillThresholdButton) {
        comboKillThresholdButton.addEventListener('click', () => {
          const suggestedStart = Number(state.comboSummaryStartToKill);
          if (!Number.isFinite(suggestedStart)) return;
          comboState.global = comboState.global && typeof comboState.global === 'object' ? comboState.global : {};
          comboState.global.hp = suggestedStart;
          hpInput.value = suggestedStart;
          calculate();
          markStateDirty();
        });
      }

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
          if (trajectoryState.snapEnabled && state.customPosition && !state.comboLockPosition) {
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
      const defaultDefender = Smash64Calculator.characters.find((entry) => entry.key === 'Luigi') || defaultCharacter;
      const defaultAttacker = Smash64Calculator.characters.find((entry) => entry.key === 'Mario') || defaultCharacter;
      if (defaultCharacter) {
        setDefender(defaultDefender.key);
        setSelectValue(defenderDropdown, defenderSelect, defaultDefender.key);
        if (defaultAttacker) {
          setSelectValue(attackerDropdown, attackerSelect, defaultAttacker.key);
        }
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

      if (initialComboState) {
        if (initialDataState) {
          const expandedState = expandStateFromDelta(baselineState, initialDataState);
          if (expandedState) {
            await applyStateSnapshot(expandedState);
          }
        }
        await applyComboPayload(initialComboState);
      } else if (initialDataState) {
        const expandedState = expandStateFromDelta(baselineState, initialDataState);
        if (expandedState) {
          await applyStateSnapshot(expandedState);
        }
      } else {
        comboState.activeIndex = 0;
        comboState.moves = [readMoveFromInputs({ includeDerived: true })];
        syncGlobalFromUI();
        renderComboStrip();
        applyComboLocks();
        calculate();
        suppressUrlSync = false;
      }

      languageNavigationReady = true;
    })();
