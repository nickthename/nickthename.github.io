(() => {
  const app = window.CalcApp || {};
  const state = app.state || (app.state = {});
  const constants = app.constants || {};
  const elements = app.elements || {};
  const trajectoryElements = app.trajectoryElements || {};
  const trajectoryState = app.trajectoryState || {};

  const BLASTZONE_LIMITS = constants.BLASTZONE_LIMITS || { left: -9000, right: 9000, bottom: -3500, top: 8300 };
  const POSITION_DATA = constants.POSITION_DATA || {};
  const STAGE_VIEW_MARGIN_X = constants.STAGE_VIEW_MARGIN_X || 420;
  const STAGE_VIEW_TOP_MARGIN = constants.STAGE_VIEW_TOP_MARGIN || 1800;
  const STAGE_VIEW_BOTTOM_MARGIN = constants.STAGE_VIEW_BOTTOM_MARGIN || 420;
  const BLASTZONE_MARGIN = constants.BLASTZONE_MARGIN || 200;
  const WORLD_EXTENT = constants.WORLD_EXTENT || 40000;
  const LIVE_AREA_MARGIN = constants.LIVE_AREA_MARGIN || 1;

  const {
    positionHorizontalSelect,
    positionVerticalSelect,
    targetStateSelect,
    doubleJumpArmorToggle,
  } = elements;

  const stageToDisplayY = (value) => -value;
  const displayToStageY = (value) => -value;

  const STAGE_HALF_WIDTH = POSITION_DATA.stage ? POSITION_DATA.stage.halfWidth : 0;

  const clampToLiveArea = (x, y) => {
    const minX = BLASTZONE_LIMITS.left + LIVE_AREA_MARGIN;
    const maxX = BLASTZONE_LIMITS.right - LIVE_AREA_MARGIN;
    const minY = BLASTZONE_LIMITS.bottom + LIVE_AREA_MARGIN;
    const maxY = BLASTZONE_LIMITS.top - LIVE_AREA_MARGIN;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  const isPositionOnPlatform = (position) => {
    const verticalTolerance = 1;
    return Object.values(POSITION_DATA).some((platform) => {
      if (!platform) return false;
      const withinX = position.x >= (platform.center - platform.halfWidth - 0.5)
        && position.x <= (platform.center + platform.halfWidth + 0.5);
      return withinX && Math.abs(position.y - platform.y) <= verticalTolerance;
    });
  };

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

  const getCameraBounds = (mode, dynamicBounds) => {
    switch (mode) {
      case 'stage':
        return STAGE_VIEW_BOX;
      case 'blastzone':
        return BLASTZONE_VIEW_BOX;
      default:
        return dynamicBounds;
    }
  };

  const computeTrajectoryBounds = (points) => {
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
  };

  const applyTrajectoryViewBox = (bounds) => {
    trajectoryState.viewBox = bounds;
    if (trajectoryElements.svg) {
      trajectoryElements.svg.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);
    }
    updateBlastzoneOverlay();
  };

  const updateBlastzoneOverlay = () => {
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
  };

  const renderStageGeometry = () => {
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
  };

  const updateTrajectoryDisplay = (startPosition, trajectoryPoints, finalPosition, hitstunFrames, options = {}) => {
    if (!trajectoryElements.svg) return;
    const killFrameLimit = Number.isFinite(options.killFrameLimit) ? Math.max(0, Math.trunc(options.killFrameLimit)) : null;
    const allowEndPointWhenKill = Boolean(options.allowEndPointWhenKill);

    const usablePoints = trajectoryPoints.length > 0
      ? trajectoryPoints
      : [{ frame: 0, x: startPosition.x, y: startPosition.y }];

    let killEntryPoint = null;
    for (let i = 0; i < usablePoints.length; i += 1) {
      const point = usablePoints[i];
      if (app.isKill && app.isKill(point.x, point.y)) {
        killEntryPoint = point;
        break;
      }
    }
    if (!killEntryPoint && app.isKill && app.isKill(finalPosition.x, finalPosition.y)) {
      const finalFrame = hitstunFrames;
      killEntryPoint = { frame: finalFrame, x: finalPosition.x, y: finalPosition.y };
    }

    let killDisplayPoint = killEntryPoint;
    if (killEntryPoint && killFrameLimit !== null && killEntryPoint.frame > killFrameLimit) {
      killDisplayPoint = null;
    }

    const trimmedPoints = killEntryPoint
      ? usablePoints.filter((pt) => pt.frame <= killEntryPoint.frame)
      : usablePoints;

    const boundsAnchor = killEntryPoint || finalPosition;
    const bounds = computeTrajectoryBounds([...trimmedPoints, startPosition, boundsAnchor]);
    const viewBounds = getCameraBounds(trajectoryState.cameraMode, bounds);
    if (trajectoryState.cameraMode === 'fit' && trajectoryState.dragging) {
      trajectoryState.pendingFitBounds = viewBounds;
    } else {
      trajectoryState.pendingFitBounds = null;
      applyTrajectoryViewBox(viewBounds);
    }
    renderStageGeometry();

    const displayPoints = trimmedPoints.map((pt) => ({
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
      const killDiffers = !killDisplayPoint
        || Math.abs(finalPosition.x - killDisplayPoint.x) > 0.5
        || Math.abs(finalPosition.y - killDisplayPoint.y) > 0.5;
      trajectoryElements.end.style.display = (killDisplayPoint && (killDiffers || !allowEndPointWhenKill)) ? 'none' : '';
    }

    if (trajectoryElements.killMarker) {
      if (killDisplayPoint) {
        const killDisplayY = stageToDisplayY(killDisplayPoint.y);
        const viewSpan = Math.max(trajectoryState.viewBox.width, trajectoryState.viewBox.height);
        const size = Math.max(120, Math.min(320, viewSpan * 0.035)) * 0.7;
        const pathData = [
          `M ${killDisplayPoint.x - size} ${killDisplayY - size} L ${killDisplayPoint.x + size} ${killDisplayY + size}`,
          `M ${killDisplayPoint.x + size} ${killDisplayY - size} L ${killDisplayPoint.x - size} ${killDisplayY + size}`,
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
  };

  const getStageCoordinatesFromEvent = (evt) => {
    if (!trajectoryElements.svg) return null;
    const svgPoint = trajectoryElements.svg.createSVGPoint();
    svgPoint.x = evt.clientX;
    svgPoint.y = evt.clientY;
    const ctm = trajectoryElements.svg.getScreenCTM();
    if (!ctm) return null;
    const transformed = svgPoint.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: displayToStageY(transformed.y) };
  };

  const resolvePositionSelection = (stageX, stageY) => {
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
  };

  const clearPresetSelection = () => {
    state.suppressPositionChange = true;
    if (positionHorizontalSelect) {
      positionHorizontalSelect.value = '';
    }
    if (positionVerticalSelect) {
      positionVerticalSelect.value = '';
    }
    state.suppressPositionChange = false;
  };

  const setCustomPositionDirect = (stageX, stageY) => {
    const clamped = clampToLiveArea(stageX, stageY);
    state.customPosition = { x: clamped.x, y: clamped.y };
    clearPresetSelection();
    if (typeof app.syncPositionInputs === 'function') {
      app.syncPositionInputs();
    }
  };

  const setPositionFromStageCoords = (stageX, stageY, forceUpdate = false) => {
    const clamped = clampToLiveArea(stageX, stageY);
    stageX = clamped.x;
    stageY = clamped.y;

    const selection = resolvePositionSelection(stageX, stageY);
    const snappedPosition = typeof app.computePosition === 'function'
      ? app.computePosition(selection.horizontalKey, selection.verticalKey)
      : { x: stageX, y: stageY };
    const dx = stageX - snappedPosition.x;
    const dy = stageY - snappedPosition.y;
    const distanceSq = (dx * dx) + (dy * dy);
    const shouldSnap = trajectoryState.snapEnabled && distanceSq <= trajectoryState.snapDistanceSq;

    let newHorizontal = selection.horizontalKey;
    let newVertical = selection.verticalKey;
    let positionChanged = false;
    let grounded = isPositionOnPlatform({ x: stageX, y: stageY });

    if (shouldSnap) {
      if (state.customPosition !== null) {
        state.customPosition = null;
        positionChanged = true;
      }
      stageX = snappedPosition.x;
      stageY = snappedPosition.y;
      grounded = true;
    } else {
      const prev = state.customPosition ? { ...state.customPosition } : null;
      setCustomPositionDirect(stageX, stageY);
      const current = state.customPosition;
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
        state.doubleJumpArmorLiftActive = false;
        state.doubleJumpArmorAnchor = null;
      }
    }

    state.suppressPositionChange = true;
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
    state.suppressPositionChange = false;

    if (grounded) {
      if (targetStateSelect && targetStateSelect.value !== 'airborne') {
        state.lastGroundState = targetStateSelect.value || state.lastGroundState;
        state.autoAirborneActive = false;
      } else if (state.autoAirborneActive && targetStateSelect) {
        const groundState = state.lastGroundState || 'standing';
        if (targetStateSelect.value !== groundState) {
          targetStateSelect.value = groundState;
          positionChanged = true;
        }
        state.lastGroundState = groundState;
        state.autoAirborneActive = false;
      }
    } else if (targetStateSelect) {
      const currentState = targetStateSelect.value;
      if (currentState !== 'airborne') {
        if (currentState) {
          state.lastGroundState = currentState;
        }
        targetStateSelect.value = 'airborne';
        positionChanged = true;
      }
      state.autoAirborneActive = true;
    }

    if (typeof app.syncPositionInputs === 'function') {
      app.syncPositionInputs();
    }

    if (forceUpdate || positionChanged) {
      if (typeof app.calculate === 'function') {
        app.calculate();
      }
      if (typeof app.markStateDirty === 'function') {
        app.markStateDirty();
      }
    }
  };

  const handleTrajectoryPointerDown = (evt) => {
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
  };

  const handleTrajectoryPointerMove = (evt) => {
    if (!trajectoryState.dragging || evt.pointerId !== trajectoryState.pointerId) return;
    const coords = getStageCoordinatesFromEvent(evt);
    if (!coords) return;
    evt.preventDefault();
    setPositionFromStageCoords(coords.x, coords.y, false);
  };

  const handleTrajectoryPointerUp = (evt) => {
    if (!trajectoryState.dragging || evt.pointerId !== trajectoryState.pointerId) return;
    trajectoryState.dragging = false;
    trajectoryState.pointerId = null;
    if (trajectoryElements.svg && trajectoryElements.svg.releasePointerCapture) {
      trajectoryElements.svg.releasePointerCapture(evt.pointerId);
    }
    if (trajectoryState.cameraMode === 'fit' && typeof app.calculate === 'function') {
      app.calculate();
    }
  };

  app.isPositionOnPlatform = isPositionOnPlatform;
  app.clampToLiveArea = clampToLiveArea;
  app.updateTrajectoryDisplay = updateTrajectoryDisplay;
  app.renderStageGeometry = renderStageGeometry;
  app.applyTrajectoryViewBox = applyTrajectoryViewBox;
  app.setPositionFromStageCoords = setPositionFromStageCoords;
  app.setCustomPositionDirect = setCustomPositionDirect;
  app.handleTrajectoryPointerDown = handleTrajectoryPointerDown;
  app.handleTrajectoryPointerMove = handleTrajectoryPointerMove;
  app.handleTrajectoryPointerUp = handleTrajectoryPointerUp;
  app.stageToDisplayY = stageToDisplayY;
  app.displayToStageY = displayToStageY;
})();
