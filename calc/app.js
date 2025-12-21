(async function () {
      const config = window.CALC_CONFIG || {};
      const UI_TEXT = window.CALC_I18N || {};
      const PAGE_LANGUAGE = config.pageLanguage || 'en';
      const LANGUAGE_PATHS = config.languagePaths || { en: '/calc/', ja: '/ja/calc/' };
      const LOCAL_STORAGE_LANGUAGE_KEY = config.localStorageLanguageKey || 'smash64:lang';
      const CHARACTER_ICONS = config.characterIcons || {};
      const MOVESET_FILES = config.movesetFiles || { U: '/calc/movesets.json', J: '/calc/j_movesets.json' };

      const form = document.getElementById('calculator-form');
      const defenderSelect = document.getElementById('defender-select');
      const attackerSelect = document.getElementById('attacker-select');
      const moveSelect = document.getElementById('move-select');
      const moveDetails = document.getElementById('move-details');

      const weightInput = document.getElementById('weight-input');
      const fallAccelInput = document.getElementById('fall-accel-input');
      const maxFallInput = document.getElementById('max-fall-input');
      const hpInput = document.getElementById('hp-input');
      const damageInput = document.getElementById('damage-input');
      const angleInput = document.getElementById('angle-input');
      const kbsInput = document.getElementById('kbs-input');
      const bkbInput = document.getElementById('bkb-input');
      const fkbInput = document.getElementById('fkb-input');
      const stalenessButtons = Array.from(document.querySelectorAll('[data-staleness]'));
      const cameraButtons = Array.from(document.querySelectorAll('[data-camera-mode]'));
      const electricToggle = document.getElementById('electric-toggle');
      const throwToggle = document.getElementById('throw-toggle');
      const targetStateSelect = document.getElementById('target-state-select');
      const simulationSelect = document.getElementById('simulation-select');
      const comboDelayInput = document.getElementById('combo-delay-input');
      const comboDelayRow = document.getElementById('combo-delay-row');
      const attackHandicapInput = document.getElementById('attack-handicap-input');
      const defenseHandicapInput = document.getElementById('defense-handicap-input');
      const positionHorizontalSelect = document.getElementById('position-horizontal');
      const positionVerticalSelect = document.getElementById('position-vertical');
      const positionXInput = document.getElementById('position-x-input');
      const positionYInput = document.getElementById('position-y-input');
      const debugToggle = document.getElementById('debug-toggle');
      const snapToggle = document.getElementById('snap-toggle');
      const doubleJumpArmorRow = document.getElementById('double-jump-armor-row');
      const doubleJumpArmorToggle = document.getElementById('double-jump-armor-toggle');
      const languageSelect = document.getElementById('language-select');
      const versionSelect = document.getElementById('version-select');
      const versionSelectorRoot = document.querySelector('[data-version-language-selector]');

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

      const outputNodes = {
        finalPercent: document.getElementById('final-percent-output'),
        percentBreakdown: document.getElementById('percent-breakdown'),
        knockbackBreakdown: document.getElementById('knockback-breakdown'),
        hitlag: document.getElementById('hitlag-value'),
        hitstun: document.getElementById('hitstun-value'),
        knockdown: document.getElementById('knockdown-status'),
        initVx: document.getElementById('init-vx-value'),
        initVy: document.getElementById('init-vy-value'),
        velocityMag: document.getElementById('velocity-mag-value'),
        totalX: document.getElementById('total-x-value'),
        totalY: document.getElementById('total-y-value'),
        displacementMeta: document.getElementById('displacement-meta'),
        attackMult: document.getElementById('attack-multiplier-value'),
        defenseMult: document.getElementById('defense-multiplier-value'),
        vectorLine: document.getElementById('vector-line'),
        positionOutput: document.getElementById('position-output'),
        finalPosition: document.getElementById('final-position-output'),
        killOutput: document.getElementById('kill-output'),
        killThresholdOutput: document.getElementById('kill-threshold-output'),
        knockdownThresholdOutput: document.getElementById('knockdown-threshold-output'),
        armorStatus: document.getElementById('armor-status'),
        armorThresholdOutput: document.getElementById('armor-threshold-output'),
        armorBlock: document.getElementById('armor-status-block'),
        knockdownRow: document.getElementById('knockdown-row'),
      };

      const BLASTZONE_LIMITS = { left: -9000, right: 9000, bottom: -3500, top: 8300 };

      const POSITION_DATA = {
        stage: { y: 0, center: 0, halfWidth: 2318 },
        'left-platform': { y: 904, center: -1396, halfWidth: 445 },
        'right-platform': { y: 907, center: 1421.5, halfWidth: 470.5 },
        'top-platform': { y: 1542, center: 0, halfWidth: 570 },
      };

      const trajectoryElements = {
        svg: document.getElementById('trajectory-svg'),
        path: document.getElementById('trajectory-path'),
        pointsGroup: document.getElementById('trajectory-points'),
        start: document.getElementById('trajectory-start'),
        end: document.getElementById('trajectory-end'),
        killMarker: document.getElementById('trajectory-kill-marker'),
        blastzone: document.getElementById('trajectory-blastzone'),
        blastzoneOutside: document.getElementById('trajectory-blastzone-outside'),
        stage: {
          ground: document.getElementById('trajectory-stage-ground'),
          left: document.getElementById('trajectory-stage-left'),
          right: document.getElementById('trajectory-stage-right'),
          top: document.getElementById('trajectory-stage-top'),
        },
      };

      const trajectoryState = {
        viewBox: { minX: -2500, minY: -2000, width: 5000, height: 4000 },
        dragging: false,
        pointerId: null,
        cameraMode: 'fit',
        snapEnabled: true,
        snapDistanceSq: 260 * 260,
      };

      const STAGE_HALF_WIDTH = POSITION_DATA.stage.halfWidth;
      let suppressCustomPositionInput = false;
      let stalenessValue = 'fresh';
      let customPosition = null;
      let autoAirborneActive = false;
      let lastGroundState = targetStateSelect.value || 'standing';
      let doubleJumpArmorLiftActive = false;
      let doubleJumpArmorAnchor = null;

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

      function getActiveStagePosition() {
        if (customPosition !== null) {
          return { x: customPosition.x, y: customPosition.y };
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
        suppressCustomPositionInput = true;
        positionXInput.value = formatPositionInputValue(active.x);
        positionYInput.value = formatPositionInputValue(active.y);
        suppressCustomPositionInput = false;
      }
      function stageToDisplayY(value) {
        return -value;
      }

      function displayToStageY(value) {
        return -value;
      }

      const STAGE_VIEW_MARGIN_X = 420;
      const STAGE_VIEW_TOP_MARGIN = 1800;
      const STAGE_VIEW_BOTTOM_MARGIN = 420;
      const BLASTZONE_MARGIN = 200;
      const WORLD_EXTENT = 40000;
      const LIVE_AREA_MARGIN = 1;
      let doubleJumpArmorThreshold = (Smash64Calculator.doubleJumpArmorValue || 140);
      const DOUBLE_JUMP_ARMOR_LIFT = 160;

      function clampToLiveArea(x, y) {
        const minX = BLASTZONE_LIMITS.left + LIVE_AREA_MARGIN;
        const maxX = BLASTZONE_LIMITS.right - LIVE_AREA_MARGIN;
        const minY = BLASTZONE_LIMITS.bottom + LIVE_AREA_MARGIN;
        const maxY = BLASTZONE_LIMITS.top - LIVE_AREA_MARGIN;
        return {
          x: Math.min(Math.max(x, minX), maxX),
          y: Math.min(Math.max(y, minY), maxY),
        };
      }

      function isPositionOnPlatform(position) {
        const verticalTolerance = 1;
        return Object.values(POSITION_DATA).some((platform) => {
          if (!platform) return false;
          const withinX = position.x >= (platform.center - platform.halfWidth - 0.5)
            && position.x <= (platform.center + platform.halfWidth + 0.5);
          return withinX && Math.abs(position.y - platform.y) <= verticalTolerance;
        });
      }

      const STAGE_EXTENTS = (() => {
        const xs = [-STAGE_HALF_WIDTH, STAGE_HALF_WIDTH];
        const ys = [0];
        Object.values(POSITION_DATA).forEach((platform) => {
          if (!platform) return;
          xs.push(platform.center - platform.halfWidth, platform.center + platform.halfWidth);
          ys.push(platform.y);
        });
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        };
      })();

      const STAGE_VIEW_BOX = (() => {
        const stageTop = STAGE_EXTENTS.maxY + STAGE_VIEW_TOP_MARGIN;
        const candidateBottom = STAGE_EXTENTS.minY - STAGE_VIEW_BOTTOM_MARGIN;
        const stageBottom = Math.min(candidateBottom, -STAGE_VIEW_BOTTOM_MARGIN);
        const minX = STAGE_EXTENTS.minX - STAGE_VIEW_MARGIN_X;
        const maxX = STAGE_EXTENTS.maxX + STAGE_VIEW_MARGIN_X;
        const width = maxX - minX;
        const minY = stageToDisplayY(stageTop);
        const height = stageToDisplayY(stageBottom) - minY;
        return { minX, minY, width, height };
      })();

      const BLASTZONE_VIEW_BOX = (() => {
        const minX = BLASTZONE_LIMITS.left - BLASTZONE_MARGIN;
        const maxX = BLASTZONE_LIMITS.right + BLASTZONE_MARGIN;
        const top = BLASTZONE_LIMITS.top + BLASTZONE_MARGIN;
        const bottom = BLASTZONE_LIMITS.bottom - BLASTZONE_MARGIN;
        const width = maxX - minX;
        const minY = stageToDisplayY(top);
        const height = stageToDisplayY(bottom) - minY;
        return { minX, minY, width, height };
      })();

      function getCameraBounds(mode, dynamicBounds) {
        switch (mode) {
          case 'stage':
            return STAGE_VIEW_BOX;
          case 'blastzone':
            return BLASTZONE_VIEW_BOX;
          default:
            return dynamicBounds;
        }
      }

      function isYoshiDefender() {
        return defenderSelect.value === 'Yoshi';
      }

      function computeTrajectoryBounds(points) {
        const xs = [];
        const ys = [];

        if (points.length === 0) {
          xs.push(-STAGE_HALF_WIDTH, STAGE_HALF_WIDTH);
          ys.push(stageToDisplayY(0));
        } else {
          points.forEach((pt) => {
            xs.push(pt.x);
            ys.push(stageToDisplayY(pt.y));
          });
        }

        Object.values(POSITION_DATA).forEach((platform) => {
          if (!platform) return;
          xs.push(platform.center - platform.halfWidth, platform.center + platform.halfWidth);
          ys.push(stageToDisplayY(platform.y));
        });

        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        let minY = Math.min(...ys);
        let maxY = Math.max(...ys);

        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
          minX = -STAGE_HALF_WIDTH;
          maxX = STAGE_HALF_WIDTH;
        }
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
          const base = stageToDisplayY(0);
          minY = base - 200;
          maxY = base + 200;
        }

        const marginX = 200;
        const marginY = 200;

        const width = Math.max(800, maxX - minX);
        const height = Math.max(800, maxY - minY);

        return {
          minX: minX - marginX,
          minY: minY - marginY,
          width: width + marginX * 2,
          height: height + marginY * 2,
        };
      }

      function applyTrajectoryViewBox(bounds) {
        trajectoryState.viewBox = bounds;
        if (trajectoryElements.svg) {
          trajectoryElements.svg.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);
        }
        updateBlastzoneOverlay();
      }

      function updateBlastzoneOverlay() {
        if (!trajectoryElements.blastzoneOutside) return;

        const outerMinX = -WORLD_EXTENT;
        const outerMaxX = WORLD_EXTENT;
        const outerMinY = -WORLD_EXTENT;
        const outerMaxY = WORLD_EXTENT;

        const safeMinX = BLASTZONE_LIMITS.left;
        const safeMaxX = BLASTZONE_LIMITS.right;
        let safeMinY = stageToDisplayY(BLASTZONE_LIMITS.top);
        let safeMaxY = stageToDisplayY(BLASTZONE_LIMITS.bottom);
        if (safeMinY > safeMaxY) {
          const swap = safeMinY;
          safeMinY = safeMaxY;
          safeMaxY = swap;
        }

        const pathData = [
          `M ${outerMinX} ${outerMinY} H ${outerMaxX} V ${outerMaxY} H ${outerMinX} Z`,
          `M ${safeMinX} ${safeMinY} H ${safeMaxX} V ${safeMaxY} H ${safeMinX} Z`,
        ].join(' ');

        trajectoryElements.blastzoneOutside.setAttribute('d', pathData);
      }

      function renderStageGeometry() {
        const stageGroup = trajectoryElements.stage;
        if (!stageGroup || !stageGroup.ground) return;

        const assignLine = (element, platform) => {
          if (!element || !platform) return;
          const x1 = platform.center - platform.halfWidth;
          const x2 = platform.center + platform.halfWidth;
          const y = stageToDisplayY(platform.y);
          element.setAttribute('x1', x1);
          element.setAttribute('x2', x2);
          element.setAttribute('y1', y);
          element.setAttribute('y2', y);
        };

        assignLine(stageGroup.ground, POSITION_DATA.stage);
        assignLine(stageGroup.left, POSITION_DATA['left-platform']);
        assignLine(stageGroup.right, POSITION_DATA['right-platform']);
        assignLine(stageGroup.top, POSITION_DATA['top-platform']);

        if (trajectoryElements.blastzone) {
          const rect = trajectoryElements.blastzone;
          const width = BLASTZONE_LIMITS.right - BLASTZONE_LIMITS.left;
          const topDisplay = stageToDisplayY(BLASTZONE_LIMITS.top);
          const bottomDisplay = stageToDisplayY(BLASTZONE_LIMITS.bottom);
          rect.setAttribute('x', BLASTZONE_LIMITS.left);
          rect.setAttribute('width', width);
          rect.setAttribute('y', topDisplay);
          rect.setAttribute('height', bottomDisplay - topDisplay);
        }
      }

      function updateTrajectoryDisplay(startPosition, trajectoryPoints, finalPosition, hitstunFrames) {
        if (!trajectoryElements.svg) return;

        const usablePoints = trajectoryPoints.length > 0
          ? trajectoryPoints
          : [{ frame: 0, x: startPosition.x, y: startPosition.y }];

        const bounds = computeTrajectoryBounds([...usablePoints, startPosition, finalPosition]);
        const viewBounds = getCameraBounds(trajectoryState.cameraMode, bounds);
        applyTrajectoryViewBox(viewBounds);
        renderStageGeometry();

        let killEntryPoint = null;
        for (let i = 0; i < usablePoints.length; i += 1) {
          const point = usablePoints[i];
          if (isKill(point.x, point.y)) {
            killEntryPoint = point;
            break;
          }
        }
        if (!killEntryPoint && isKill(finalPosition.x, finalPosition.y)) {
          killEntryPoint = { frame: hitstunFrames, x: finalPosition.x, y: finalPosition.y };
        }

        const displayPoints = usablePoints.map((pt) => ({
          frame: pt.frame,
          x: pt.x,
          y: stageToDisplayY(pt.y),
        }));

        if (trajectoryElements.path) {
          if (displayPoints.length > 1) {
            const pointsString = displayPoints.map((pt) => `${pt.x},${pt.y}`).join(' ');
            trajectoryElements.path.setAttribute('points', pointsString);
            trajectoryElements.path.style.opacity = 0.85;
          } else {
            trajectoryElements.path.removeAttribute('points');
            trajectoryElements.path.style.opacity = 0;
          }
        }

        const pointsGroup = trajectoryElements.pointsGroup;
        if (pointsGroup) {
          pointsGroup.innerHTML = '';
          if (displayPoints.length > 1) {
            for (let i = 1; i < displayPoints.length; i += 1) {
              const pt = displayPoints[i];
              const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              node.setAttribute('class', 'trajectory-point');
              node.setAttribute('cx', pt.x);
              node.setAttribute('cy', pt.y);
              node.setAttribute('r', 40);
              pointsGroup.appendChild(node);
            }
          }
        }

        if (trajectoryElements.start) {
          const startDisplay = stageToDisplayY(startPosition.y);
          trajectoryElements.start.setAttribute('cx', startPosition.x);
          trajectoryElements.start.setAttribute('cy', startDisplay);
          trajectoryElements.start.dataset.stageX = startPosition.x.toFixed(2);
          trajectoryElements.start.dataset.stageY = startPosition.y.toFixed(2);
        }

        if (trajectoryElements.end) {
          const finalDisplay = stageToDisplayY(finalPosition.y);
          trajectoryElements.end.setAttribute('cx', finalPosition.x);
          trajectoryElements.end.setAttribute('cy', finalDisplay);
          trajectoryElements.end.dataset.stageX = finalPosition.x.toFixed(2);
          trajectoryElements.end.dataset.stageY = finalPosition.y.toFixed(2);
          trajectoryElements.end.style.display = killEntryPoint ? 'none' : '';
        }

        if (trajectoryElements.killMarker) {
          if (killEntryPoint) {
            const killDisplayY = stageToDisplayY(killEntryPoint.y);
            const viewSpan = Math.max(trajectoryState.viewBox.width, trajectoryState.viewBox.height);
            const size = Math.max(120, Math.min(320, viewSpan * 0.035));
            const pathData = [
              `M ${killEntryPoint.x - size} ${killDisplayY - size} L ${killEntryPoint.x + size} ${killDisplayY + size}`,
              `M ${killEntryPoint.x + size} ${killDisplayY - size} L ${killEntryPoint.x - size} ${killDisplayY + size}`,
            ].join(' ');
            trajectoryElements.killMarker.setAttribute('d', pathData);
            trajectoryElements.killMarker.classList.add('is-visible');
          } else {
            trajectoryElements.killMarker.removeAttribute('d');
            trajectoryElements.killMarker.classList.remove('is-visible');
          }
        }

        if (trajectoryElements.svg) {
          trajectoryElements.svg.setAttribute('data-hitstun', String(hitstunFrames));
        }
      }

      function getStageCoordinatesFromEvent(evt) {
        if (!trajectoryElements.svg) return null;
        const svgPoint = trajectoryElements.svg.createSVGPoint();
        svgPoint.x = evt.clientX;
        svgPoint.y = evt.clientY;
        const ctm = trajectoryElements.svg.getScreenCTM();
        if (!ctm) return null;
        const transformed = svgPoint.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: displayToStageY(transformed.y) };
      }

      function resolvePositionSelection(stageX, stageY) {
        let bestKey = 'stage';
        let bestScore = Number.POSITIVE_INFINITY;
        Object.entries(POSITION_DATA).forEach(([key, platform]) => {
          if (!platform) return;
          const deltaX = Math.max(0, Math.abs(stageX - platform.center) - platform.halfWidth);
          const deltaY = Math.abs(stageY - platform.y);
          const score = (deltaX * deltaX) + (deltaY * deltaY * 0.4);
          if (score < bestScore) {
            bestScore = score;
            bestKey = key;
          }
        });

        const platform = POSITION_DATA[bestKey];
        if (!platform) {
          return { verticalKey: 'stage', horizontalKey: 'center' };
        }

        const clampedX = Math.max(platform.center - platform.halfWidth, Math.min(stageX, platform.center + platform.halfWidth));
        const relative = platform.halfWidth > 0 ? (clampedX - platform.center) / platform.halfWidth : 0;
        let horizontalKey = 'center';
        if (relative <= -0.33) {
          horizontalKey = 'left';
        } else if (relative >= 0.33) {
          horizontalKey = 'right';
      }

      return { verticalKey: bestKey, horizontalKey };
      }

      let suppressPositionChange = false;

      function clearPresetSelection() {
        suppressPositionChange = true;
        if (positionHorizontalSelect) {
          positionHorizontalSelect.value = '';
        }
        if (positionVerticalSelect) {
          positionVerticalSelect.value = '';
        }
        suppressPositionChange = false;
      }

      function setPositionFromStageCoords(stageX, stageY, forceUpdate = false) {
        const clamped = clampToLiveArea(stageX, stageY);
        stageX = clamped.x;
        stageY = clamped.y;

        const selection = resolvePositionSelection(stageX, stageY);
        const snappedPosition = computePosition(selection.horizontalKey, selection.verticalKey);
        const dx = stageX - snappedPosition.x;
        const dy = stageY - snappedPosition.y;
        const distanceSq = (dx * dx) + (dy * dy);
        const shouldSnap = trajectoryState.snapEnabled && distanceSq <= trajectoryState.snapDistanceSq;

        let newHorizontal = selection.horizontalKey;
      let newVertical = selection.verticalKey;
        let positionChanged = false;
        let grounded = isPositionOnPlatform({ x: stageX, y: stageY });

        if (shouldSnap) {
          if (customPosition !== null) {
            customPosition = null;
            positionChanged = true;
          }
          stageX = snappedPosition.x;
          stageY = snappedPosition.y;
          grounded = true;
        } else {
          const prev = customPosition ? { ...customPosition } : null;
          setCustomPositionDirect(stageX, stageY);
          const current = customPosition;
          if (!prev || !current
            || Math.abs(prev.x - current.x) > 0.25
            || Math.abs(prev.y - current.y) > 0.25) {
            positionChanged = true;
          }
          stageX = current ? current.x : stageX;
          stageY = current ? current.y : stageY;
          newHorizontal = '';
          newVertical = '';
          if (trajectoryState.dragging && doubleJumpArmorToggle && doubleJumpArmorToggle.checked) {
            doubleJumpArmorLiftActive = false;
            doubleJumpArmorAnchor = null;
          }
        }

        suppressPositionChange = true;
        if (positionHorizontalSelect) {
          if (newHorizontal) {
            if (positionHorizontalSelect.value !== newHorizontal) {
              positionHorizontalSelect.value = newHorizontal;
              positionChanged = true;
            }
          } else if (positionHorizontalSelect.selectedIndex !== -1) {
            positionHorizontalSelect.selectedIndex = -1;
            positionChanged = true;
          }
        }
        if (positionVerticalSelect) {
          if (newVertical) {
            if (positionVerticalSelect.value !== newVertical) {
              positionVerticalSelect.value = newVertical;
              positionChanged = true;
            }
          } else if (positionVerticalSelect.selectedIndex !== -1) {
            positionVerticalSelect.selectedIndex = -1;
            positionChanged = true;
          }
        }
        suppressPositionChange = false;

        if (grounded) {
          if (targetStateSelect.value !== 'airborne') {
            lastGroundState = targetStateSelect.value || lastGroundState;
            autoAirborneActive = false;
          } else if (autoAirborneActive) {
            const groundState = lastGroundState || 'standing';
            if (targetStateSelect.value !== groundState) {
              targetStateSelect.value = groundState;
              positionChanged = true;
            }
            lastGroundState = groundState;
            autoAirborneActive = false;
          }
        } else {
          const currentState = targetStateSelect.value;
          if (currentState !== 'airborne') {
            if (currentState) {
              lastGroundState = currentState;
            }
            targetStateSelect.value = 'airborne';
            positionChanged = true;
          }
          autoAirborneActive = true;
        }

        syncPositionInputs();

        if (forceUpdate || positionChanged) {
          calculate();
          markStateDirty();
        }
      }

      function setCustomPositionDirect(stageX, stageY) {
        const clamped = clampToLiveArea(stageX, stageY);
        customPosition = { x: clamped.x, y: clamped.y };
        clearPresetSelection();
        syncPositionInputs();
      }

      function enforceDoubleJumpArmorState({ skipCalculate = false, forceCalculate = false } = {}) {
        const yoshiSelected = isYoshiDefender();
        const armorEnabled = yoshiSelected && doubleJumpArmorToggle && doubleJumpArmorToggle.checked;
        let changed = false;

        if (!yoshiSelected) {
          if (doubleJumpArmorToggle && doubleJumpArmorToggle.checked) {
            doubleJumpArmorToggle.checked = false;
            changed = true;
          }
          if (doubleJumpArmorLiftActive) {
            doubleJumpArmorLiftActive = false;
            customPosition = null;
            changed = true;
          }
          autoAirborneActive = false;
          if (!skipCalculate && (changed || forceCalculate)) {
            calculate();
          }
          return;
        }

        if (armorEnabled) {
          if (targetStateSelect.value !== 'airborne') {
            if (targetStateSelect.value && targetStateSelect.value !== 'airborne') {
              lastGroundState = targetStateSelect.value;
            }
            targetStateSelect.value = 'airborne';
            changed = true;
          }

          const dropdownPosition = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
          const activePosition = customPosition ?? dropdownPosition;
          const onPlatform = isPositionOnPlatform(activePosition);
          if (onPlatform) {
            const liftedY = activePosition.y + DOUBLE_JUMP_ARMOR_LIFT;
            const currentCustom = customPosition;
            const needsLift = !currentCustom || !doubleJumpArmorLiftActive
              || Math.abs(currentCustom.x - activePosition.x) > 0.5
              || Math.abs(currentCustom.y - liftedY) > 0.5;
            if (needsLift) {
              setCustomPositionDirect(activePosition.x, liftedY);
              doubleJumpArmorLiftActive = true;
              doubleJumpArmorAnchor = { x: activePosition.x, y: activePosition.y };
              changed = true;
            }
          } else {
            doubleJumpArmorLiftActive = false;
            doubleJumpArmorAnchor = null;
          }
          autoAirborneActive = true;
        } else {
          autoAirborneActive = false;
          if (doubleJumpArmorLiftActive) {
            doubleJumpArmorLiftActive = false;
            if (doubleJumpArmorAnchor) {
              setCustomPositionDirect(doubleJumpArmorAnchor.x, doubleJumpArmorAnchor.y);
            } else {
              customPosition = null;
              syncPositionInputs();
            }
            doubleJumpArmorAnchor = null;
            changed = true;
          }
          const fallback = (lastGroundState && lastGroundState !== 'airborne') ? lastGroundState : 'standing';
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

      function handleTrajectoryPointerDown(evt) {
        if (typeof evt.button === 'number' && evt.button !== 0) return;
        const coords = getStageCoordinatesFromEvent(evt);
        if (!coords) return;
        evt.preventDefault();
        trajectoryState.dragging = true;
        trajectoryState.pointerId = evt.pointerId;
        if (trajectoryElements.svg && trajectoryElements.svg.setPointerCapture) {
          trajectoryElements.svg.setPointerCapture(evt.pointerId);
        }
        setPositionFromStageCoords(coords.x, coords.y, true);
      }

      function handleTrajectoryPointerMove(evt) {
        if (!trajectoryState.dragging || evt.pointerId !== trajectoryState.pointerId) return;
        const coords = getStageCoordinatesFromEvent(evt);
        if (!coords) return;
        evt.preventDefault();
        setPositionFromStageCoords(coords.x, coords.y, false);
      }

      function handleTrajectoryPointerUp(evt) {
        if (!trajectoryState.dragging || evt.pointerId !== trajectoryState.pointerId) return;
        trajectoryState.dragging = false;
        trajectoryState.pointerId = null;
        if (trajectoryElements.svg && trajectoryElements.svg.releasePointerCapture) {
          trajectoryElements.svg.releasePointerCapture(evt.pointerId);
        }
      }

      function updateStalenessButtons() {
        stalenessButtons.forEach((button) => {
          const isActive = button.dataset.staleness === stalenessValue;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }

      function setStaleness(value, { trigger = true } = {}) {
        if (!value) return;
        const changed = stalenessValue !== value;
        stalenessValue = value;
        updateStalenessButtons();
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
      function isKill(x, y) {
        return y >= BLASTZONE_LIMITS.top
          || y <= BLASTZONE_LIMITS.bottom
          || x <= BLASTZONE_LIMITS.left
          || x >= BLASTZONE_LIMITS.right;
      }

      let movesets = {};
      let currentMoves = [];
      let selectedMoveIndex = null;
      let selectedMoveData = null;
      let customOption = null;
      let suppressCustomFlag = false;
      let defenderCustomOption = null;
      let selectedDefenderData = null;
      let suppressDefenderCustom = false;
      let lastMoveBaseName = null;

      const normalizeLanguage = (value) => (String(value || '').toLowerCase() === 'ja' ? 'ja' : 'en');
      const VERSION_BY_LANGUAGE = { en: 'U', ja: 'J' };
      const movesetCache = {};
      let currentVersion = 'U';
      let currentLanguage = normalizeLanguage(PAGE_LANGUAGE);

      const normalizeVersion = (value) => (String(value || '').toUpperCase() === 'J' ? 'J' : 'U');

      const STALENESS_ORDER = ['fresh', 'lv3', 'lv2', 'lv1', 'stale'];
      const TARGET_STATE_ORDER = ['standing', 'crouching', 'airborne', 'laying'];
      const SIMULATION_ORDER = ['hitstun', 'velocity', 'custom'];
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
        const snapshot = {
          version: currentVersion,
          defender: readSelectValue(defenderSelect),
          attacker: readSelectValue(attackerSelect),
          moveSlot: (moveSelect ? moveSelect.selectedIndex : null),
          staleness: stalenessValue,
          targetState: readSelectValue(targetStateSelect),
          simulation: readSelectValue(simulationSelect),
          attackHandicap: readNumber(attackHandicapInput),
          defenseHandicap: readNumber(defenseHandicapInput),
          hp: readNumber(hpInput),
          doubleJumpArmor: Boolean(doubleJumpArmorToggle && doubleJumpArmorToggle.checked),
          position: {
            custom: customPosition !== null,
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
          'staleness', 'targetState', 'simulation', 'comboDelay',
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
        };
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
          moveSelect.value = '';
          moveSelect.selectedIndex = 0;
          selectedMoveIndex = null;
          selectedMoveData = null;
        } else {
          customOption.textContent = UI_TEXT.customMove;
        }
        suppressCustomFlag = false;
      }

      function populateMoves(key, { preferredMove = null, preferredSlot = null } = {}) {
        moveSelect.innerHTML = '';
        customOption = document.createElement('option');
        customOption.value = '';
        customOption.textContent = UI_TEXT.customMove;
        moveSelect.append(customOption);

        currentMoves = movesets[key] || [];
        currentMoves.forEach((move, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = move.name;
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
          moveSelect.append(option);
        });

        if (currentMoves.length > 0) {
          let optionIndex = 1;
          if (Number.isFinite(preferredSlot)) {
            optionIndex = Math.min(Math.max(0, Math.trunc(preferredSlot)), currentMoves.length);
          } else if (preferredMove) {
            const matchIndex = currentMoves.findIndex((move) => {
              const baseName = move.baseName ?? move.name ?? '';
              return baseName === preferredMove || move.name === preferredMove;
            });
            if (matchIndex >= 0) {
              optionIndex = matchIndex + 1;
            }
          }
          moveSelect.selectedIndex = optionIndex;
          applyMove(moveSelect.options[optionIndex]);
        } else {
          moveSelect.selectedIndex = 0;
          applyMove(customOption);
        }
      }

      async function applyStateSnapshot(state) {
        if (!state || typeof state !== 'object') return;
        suppressUrlSync = true;
        const targetVersion = state.version ? normalizeVersion(state.version) : currentVersion;
        await applyGameVersion(targetVersion, { initial: true });
        if (versionSelect) {
          versionSelect.value = targetVersion;
        }

        if (state.defender) {
          setSelectValue(defenderDropdown, defenderSelect, state.defender);
          setDefender(state.defender);
        }

        if (state.attacker) {
          setSelectValue(attackerDropdown, attackerSelect, state.attacker);
        }

        const preferredSlot = (typeof state.moveSlot === 'number' && Number.isFinite(state.moveSlot))
          ? Math.max(0, Math.trunc(state.moveSlot))
          : null;

        populateMoves(attackerSelect.value, { preferredSlot });

        if (typeof state.damage === 'number') damageInput.value = state.damage;
        if (typeof state.angle === 'number') angleInput.value = state.angle;
        if (typeof state.kbs === 'number') kbsInput.value = state.kbs;
        if (typeof state.bkb === 'number') bkbInput.value = state.bkb;
        if (typeof state.fkb === 'number') fkbInput.value = state.fkb;
        if (typeof state.hp === 'number') hpInput.value = state.hp;
        if (typeof state.weight === 'number') weightInput.value = state.weight;
        if (typeof state.fallAccel === 'number') fallAccelInput.value = state.fallAccel;
        if (typeof state.maxFall === 'number') maxFallInput.value = state.maxFall;
        if (typeof state.attackHandicap === 'number') attackHandicapInput.value = state.attackHandicap;
        if (typeof state.defenseHandicap === 'number') defenseHandicapInput.value = state.defenseHandicap;
        if (typeof state.comboDelay === 'number') comboDelayInput.value = state.comboDelay;

        if (typeof state.electric === 'boolean') electricToggle.checked = state.electric;
        if (typeof state.throwMove === 'boolean') throwToggle.checked = state.throwMove;

        if (typeof state.targetState === 'string') targetStateSelect.value = state.targetState;
        if (typeof state.simulation === 'string') simulationSelect.value = state.simulation;
        updateComboDelayVisibility();

        if (state.position && state.position.custom && typeof state.position.x === 'number' && typeof state.position.y === 'number') {
          setCustomPositionDirect(state.position.x, state.position.y);
        } else if (state.position) {
          suppressPositionChange = true;
          if (typeof state.position.horizontal === 'string') {
            positionHorizontalSelect.value = state.position.horizontal;
          }
          if (typeof state.position.vertical === 'string') {
            positionVerticalSelect.value = state.position.vertical;
          }
          customPosition = null;
          suppressPositionChange = false;
          syncPositionInputs();
        }

        if (typeof state.snap === 'boolean' && snapToggle) {
          snapToggle.checked = state.snap;
          trajectoryState.snapEnabled = state.snap;
        }

        if (typeof state.cameraMode === 'string') {
          setCameraMode(state.cameraMode, { trigger: false });
        }

        if (typeof state.staleness === 'string') {
          setStaleness(state.staleness, { trigger: false });
        }

        if (typeof state.doubleJumpArmor === 'boolean' && doubleJumpArmorToggle) {
          doubleJumpArmorToggle.checked = state.doubleJumpArmor;
        }

        if (typeof state.debug === 'boolean' && debugToggle) {
          debugToggle.checked = state.debug;
          debugMode = state.debug;
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
        const rawComboDelay = numericValue(comboDelayInput, 0);
        const comboDelayFrames = simulationMode === 'custom' ? rawComboDelay : 0;

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
          damageModifier: stalenessValue,
          targetState: targetStateSelect.value,
          electric: electricToggle.checked,
          throwMove: throwToggle.checked,
          doubleJumpArmor: doubleJumpArmorActive,
          simulationMode,
          comboDelay: comboDelayFrames,
        };

        const result = Smash64Calculator.compute(params);
        const computeAtPercent = (hpValue) => Smash64Calculator.compute({ ...params, hp: hpValue });
        const thresholdStepSize = 1;
        const thresholdMaxPercent = 300;
        const startPercent = params.hp;
        const staledDamage = Smash64Calculator.applyStaleness(params.baseDamage, params.damageModifier);
        const appliedDamage = params.targetState === 'laying' ? Math.ceil(staledDamage / 2) : staledDamage;
        const finalPercent = startPercent + appliedDamage;

        outputNodes.finalPercent.textContent = formatPercent(finalPercent);
        const percentSummary = `${formatPercent(startPercent)} + ${formatPercent(appliedDamage)}`;
        outputNodes.percentBreakdown.textContent = stalenessValue !== 'fresh'
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

        outputNodes.hitlag.textContent = formatIntegral(result.hitlag);
        outputNodes.hitstun.textContent = UI_TEXT.hitstunFrames({ frames: formatIntegral(result.hitstun) });
        outputNodes.knockdown.textContent = result.hitstun >= 32 ? UI_TEXT.knocksDown : UI_TEXT.noKnockdown;

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

        const dropdownPosition = computePosition(positionHorizontalSelect.value, positionVerticalSelect.value);
        const position = customPosition ? { x: customPosition.x, y: customPosition.y } : dropdownPosition;
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

        const signedInitialVX = result.initialVelocityX * (horizontalDirection === 0 ? 0 : horizontalDirection);
        const signedInitialVY = result.initialVelocityY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.initVx.textContent = formatStandard(signedInitialVX);
        outputNodes.initVy.textContent = formatStandard(signedInitialVY);

        const signedXDistance = result.totalDistanceX * (horizontalDirection === 0 ? 0 : horizontalDirection);
        const signedYDistance = result.totalDistanceY * (verticalDirection === 0 ? 0 : verticalDirection);
        outputNodes.totalX.textContent = formatStandard(signedXDistance);
        outputNodes.totalY.textContent = formatStandard(signedYDistance);
        const finalX = position.x + signedXDistance;
        const finalY = position.y + signedYDistance;
        outputNodes.finalPosition.textContent = `(${formatIntegral(finalX)}, ${formatIntegral(finalY)})`;

        const trajectoryDirectionX = horizontalDirection === 0 ? 0 : horizontalDirection;
        const trajectoryDirectionY = verticalDirection === 0 ? 0 : verticalDirection;
        const trajectoryPoints = (result.trajectory || []).map((step) => ({
          frame: step.frame,
          x: position.x + step.x * trajectoryDirectionX,
          y: position.y + step.y * trajectoryDirectionY,
        }));
        if (trajectoryPoints.length === 0) {
          trajectoryPoints.push({ frame: 0, x: position.x, y: position.y });
        }
        updateTrajectoryDisplay(position, trajectoryPoints, { x: finalX, y: finalY }, result.hitstun);

        outputNodes.killThresholdOutput.textContent = '';

        let killResult = UI_TEXT.noKill;
        if (isKill(finalX, finalY)) {
          if (finalY >= BLASTZONE_LIMITS.top) {
            killResult = UI_TEXT.killsOffTop;
          } else if (finalY <= BLASTZONE_LIMITS.bottom) {
            killResult = UI_TEXT.killsOffBottom;
          } else if (finalX <= BLASTZONE_LIMITS.left) {
            killResult = UI_TEXT.killsOffLeft;
          } else {
            killResult = UI_TEXT.killsOffRight;
          }
        }
        outputNodes.killOutput.textContent = killResult;

        let killThreshold = null;
        let testPercent = 0;
        while (testPercent <= thresholdMaxPercent) {
          const sim = computeAtPercent(testPercent);
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
          const simSignedX = sim.totalDistanceX * (simHorizontalDirection === 0 ? 0 : simHorizontalDirection);
          const simSignedY = sim.totalDistanceY * (simVerticalDirection === 0 ? 0 : simVerticalDirection);
          const testPos = {
            x: position.x + simSignedX,
            y: position.y + simSignedY,
          };
          if (isKill(testPos.x, testPos.y)) {
            killThreshold = Math.round(testPercent);
            break;
          }
          testPercent += thresholdStepSize;
        }

        outputNodes.killThresholdOutput.textContent = killThreshold !== null && killThreshold <= thresholdMaxPercent
          ? UI_TEXT.killsAt({ percent: formatIntegral(killThreshold) })
          : '';

        let framesSimulated = null;
        if (simulationMode === 'hitstun') {
          framesSimulated = result.hitstun;
        } else if (simulationMode === 'custom') {
          framesSimulated = rawComboDelay > 0 ? rawComboDelay : result.hitstun;
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
        populateMoves(attackerSelect.value);
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
          autoAirborneActive = true;
          return;
        }
        if (targetStateSelect.value !== 'airborne') {
          lastGroundState = targetStateSelect.value || lastGroundState;
          autoAirborneActive = false;
        }
      });

      if (positionXInput && positionYInput) {
        const handlePositionInput = () => {
          if (suppressCustomPositionInput) return;
          const x = Number.parseFloat(positionXInput.value);
          const y = Number.parseFloat(positionYInput.value);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
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
        if (suppressPositionChange) return;
        customPosition = null;
        syncPositionInputs();
        calculate();
        markStateDirty();
      });

      positionVerticalSelect.addEventListener('change', () => {
        if (suppressPositionChange) return;
        customPosition = null;
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
          if (trajectoryState.snapEnabled && customPosition) {
            setPositionFromStageCoords(customPosition.x, customPosition.y, true);
          }
          markStateDirty();
        });
      }

      syncPositionInputs();

      setStaleness(stalenessValue, { trigger: false });
      setCameraMode(trajectoryState.cameraMode, { trigger: false });

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
