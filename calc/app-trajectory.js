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

  const applyPlatformMagnetism = (stageX, stageY) => {
    const MAGNET_MARGIN_X = 70;
    const MAGNET_DISTANCE_Y = 70;
    let bestY = null;
    let bestDy = Number.POSITIVE_INFINITY;
    Object.values(POSITION_DATA).forEach((platform) => {
      if (!platform) return;
      const minX = platform.center - platform.halfWidth - MAGNET_MARGIN_X;
      const maxX = platform.center + platform.halfWidth + MAGNET_MARGIN_X;
      if (stageX < minX || stageX > maxX) return;
      const dy = Math.abs(stageY - platform.y);
      if (dy > MAGNET_DISTANCE_Y) return;
      if (dy < bestDy) {
        bestDy = dy;
        bestY = platform.y;
      }
    });
    if (bestY === null) return stageY;
    return bestY;
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

    const applyStageImage = (image) => {
      if (!image) return;
      const imageWidth = Number(image.dataset.imageWidth) || 600;
      const imageHeight = Number(image.dataset.imageHeight) || 440;
      const groundPx = Number(image.dataset.groundPx) || 355;
      const imageScale = Number(image.dataset.scale) || 1;
      const offsetRatio = Number(image.dataset.offsetY) || 0;
      if (imageWidth > 0 && imageHeight > 0) {
        const stageWidth = POSITION_DATA.stage.halfWidth * 2;
        const scale = (stageWidth / imageWidth) * imageScale;
        const scaledHeight = imageHeight * scale;
        const scaledWidth = stageWidth * imageScale;
        const x = POSITION_DATA.stage.center - scaledWidth / 2;
        const y = -groundPx * scale - (scaledHeight * offsetRatio);
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', scaledWidth);
        image.setAttribute('height', scaledHeight);
        return { x, y, width: scaledWidth, height: scaledHeight };
      }
      return null;
    };

    if (POSITION_DATA.stage) {
      const imageBox = applyStageImage(trajectoryElements.stageImage);
      applyStageImage(trajectoryElements.stageImageBlur);
      if (imageBox && trajectoryElements.svg) {
        const blurFilter = trajectoryElements.svg.querySelector('#stage-edge-blur');
        if (blurFilter) {
          const pad = Math.max(80, Math.max(imageBox.width, imageBox.height) * 0.06);
          blurFilter.setAttribute('x', imageBox.x - pad);
          blurFilter.setAttribute('y', imageBox.y - pad);
          blurFilter.setAttribute('width', imageBox.width + pad * 2);
          blurFilter.setAttribute('height', imageBox.height + pad * 2);
        }
      }
    }

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

    if (trajectoryElements.sky) {
      const width = BLASTZONE_LIMITS.right - BLASTZONE_LIMITS.left;
      const topDisplay = stageToDisplayY(BLASTZONE_LIMITS.top);
      const bottomDisplay = stageToDisplayY(BLASTZONE_LIMITS.bottom);
      const y = Math.min(topDisplay, bottomDisplay);
      const height = Math.abs(bottomDisplay - topDisplay);
      trajectoryElements.sky.setAttribute('x', BLASTZONE_LIMITS.left);
      trajectoryElements.sky.setAttribute('width', width);
      trajectoryElements.sky.setAttribute('y', y);
      trajectoryElements.sky.setAttribute('height', height);
    }
  };

  const buildTrajectoryData = (startPosition, trajectoryPoints, finalPosition, hitstunFrames, options = {}) => {
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

    const displayPoints = trimmedPoints.map((pt) => ({
      frame: pt.frame,
      x: pt.x,
      y: stageToDisplayY(pt.y),
    }));

    return {
      startPosition,
      finalPosition,
      hitstunFrames,
      allowEndPointWhenKill,
      killEntryPoint,
      killDisplayPoint,
      trimmedPoints,
      bounds,
      displayPoints,
    };
  };

  const mergeBounds = (boundsList, fallback) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    boundsList.forEach((bounds) => {
      if (!bounds) return;
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return fallback;
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const ensureSecondaryGroup = () => {
    if (!trajectoryElements.svg) return null;
    if (trajectoryElements.secondaryGroup) return trajectoryElements.secondaryGroup;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'trajectory-secondary');
    group.setAttribute('class', 'trajectory-secondary');
    if (trajectoryElements.path && trajectoryElements.path.parentNode) {
      trajectoryElements.path.parentNode.insertBefore(group, trajectoryElements.path);
    } else {
      trajectoryElements.svg.appendChild(group);
    }
    trajectoryElements.secondaryGroup = group;
    return group;
  };

  const ensureStartLabelsGroup = () => {
    if (!trajectoryElements.svg) return null;
    if (trajectoryElements.startLabelsGroup) return trajectoryElements.startLabelsGroup;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'trajectory-start-labels');
    group.setAttribute('class', 'trajectory-start-labels');
    if (trajectoryElements.svg) {
      trajectoryElements.svg.appendChild(group);
    }
    trajectoryElements.startLabelsGroup = group;
    return group;
  };

  const renderSecondaryTrajectories = (secondaryData) => {
    const group = ensureSecondaryGroup();
    if (!group) return;
    group.innerHTML = '';
    if (!Array.isArray(secondaryData) || secondaryData.length === 0) return;
    secondaryData.forEach((data) => {
      if (!data || !Array.isArray(data.displayPoints)) return;
      const displayPoints = data.displayPoints;
      if (displayPoints.length > 1) {
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('class', 'trajectory-path is-secondary');
        polyline.setAttribute('points', displayPoints.map((pt) => `${pt.x},${pt.y}`).join(' '));
        group.appendChild(polyline);
      }
    });
  };

  const renderStartLabels = (secondaryData) => {
    const group = ensureStartLabelsGroup();
    if (!group) return;
    group.innerHTML = '';
    if (Array.isArray(secondaryData)) {
      secondaryData.forEach((data) => {
        if (!data || !data.startPosition || !data.label) return;
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('class', 'trajectory-start-label is-secondary');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', data.startPosition.x);
        circle.setAttribute('cy', stageToDisplayY(data.startPosition.y));
        circle.setAttribute('r', 65);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', data.startPosition.x);
        text.setAttribute('y', stageToDisplayY(data.startPosition.y));
        text.setAttribute('dy', '15');
        text.textContent = String(data.label);
        labelGroup.appendChild(circle);
        labelGroup.appendChild(text);
        group.appendChild(labelGroup);
      });
    }
  };

  const updateTrajectoryDisplay = (startPosition, trajectoryPoints, finalPosition, hitstunFrames, options = {}) => {
    if (!trajectoryElements.svg) return;
    const primaryData = buildTrajectoryData(startPosition, trajectoryPoints, finalPosition, hitstunFrames, options);

    const secondaryInputs = Array.isArray(options.secondaryTrajectories) ? options.secondaryTrajectories : [];
    const secondaryData = secondaryInputs.map((entry) => {
      if (!entry) return null;
      const start = entry.startPosition || entry.start || entry.startPos;
      const points = entry.trajectoryPoints || entry.points || [];
      const end = entry.finalPosition || entry.end || entry.final;
      const hitstun = Number.isFinite(entry.hitstunFrames) ? entry.hitstunFrames : (Number.isFinite(entry.hitstun) ? entry.hitstun : 0);
      if (!start || !end) return null;
      const data = buildTrajectoryData(start, points, end, hitstun, {
        killFrameLimit: entry.killFrameLimit,
        allowEndPointWhenKill: entry.allowEndPointWhenKill,
      });
      data.label = entry.label;
      return data;
    }).filter(Boolean);

    const mergedBounds = mergeBounds(
      [primaryData.bounds, ...secondaryData.map((data) => data.bounds)],
      primaryData.bounds
    );
    const viewBounds = getCameraBounds(trajectoryState.cameraMode, mergedBounds);
    if (trajectoryState.cameraMode === 'fit' && trajectoryState.dragging) {
      trajectoryState.pendingFitBounds = viewBounds;
    } else {
      trajectoryState.pendingFitBounds = null;
      applyTrajectoryViewBox(viewBounds);
    }
    renderStageGeometry();

    renderSecondaryTrajectories(secondaryData);
    renderStartLabels(secondaryData);

    const displayPoints = primaryData.displayPoints;

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
      const startDisplay = stageToDisplayY(primaryData.startPosition.y);
      trajectoryElements.start.setAttribute('cx', primaryData.startPosition.x);
      trajectoryElements.start.setAttribute('cy', startDisplay);
      trajectoryElements.start.dataset.stageX = primaryData.startPosition.x.toFixed(2);
      trajectoryElements.start.dataset.stageY = primaryData.startPosition.y.toFixed(2);
    }

    if (trajectoryElements.end) {
      const finalDisplay = stageToDisplayY(primaryData.finalPosition.y);
      trajectoryElements.end.setAttribute('cx', primaryData.finalPosition.x);
      trajectoryElements.end.setAttribute('cy', finalDisplay);
      trajectoryElements.end.dataset.stageX = primaryData.finalPosition.x.toFixed(2);
      trajectoryElements.end.dataset.stageY = primaryData.finalPosition.y.toFixed(2);
      const killDiffers = !primaryData.killDisplayPoint
        || Math.abs(primaryData.finalPosition.x - primaryData.killDisplayPoint.x) > 0.5
        || Math.abs(primaryData.finalPosition.y - primaryData.killDisplayPoint.y) > 0.5;
      trajectoryElements.end.style.display = (primaryData.killDisplayPoint && (killDiffers || !primaryData.allowEndPointWhenKill)) ? 'none' : '';
    }

    if (trajectoryElements.killMarker) {
      if (primaryData.killDisplayPoint) {
        const killDisplayY = stageToDisplayY(primaryData.killDisplayPoint.y);
        const viewSpan = Math.max(trajectoryState.viewBox.width, trajectoryState.viewBox.height);
        const size = Math.max(120, Math.min(320, viewSpan * 0.035)) * 0.7;
        const pathData = [
          `M ${primaryData.killDisplayPoint.x - size} ${killDisplayY - size} L ${primaryData.killDisplayPoint.x + size} ${killDisplayY + size}`,
          `M ${primaryData.killDisplayPoint.x + size} ${killDisplayY - size} L ${primaryData.killDisplayPoint.x - size} ${killDisplayY + size}`,
        ].join(' ');
        trajectoryElements.killMarker.setAttribute('d', pathData);
        trajectoryElements.killMarker.classList.add('is-visible');
      } else {
        trajectoryElements.killMarker.removeAttribute('d');
        trajectoryElements.killMarker.classList.remove('is-visible');
      }
    }

    if (trajectoryElements.svg) {
      trajectoryElements.svg.setAttribute('data-hitstun', String(primaryData.hitstunFrames));
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

  const setPositionFromStageCoords = (stageX, stageY, options = false) => {
    const isOptions = typeof options === 'object' && options !== null;
    const forceUpdate = isOptions ? Boolean(options.forceUpdate) : Boolean(options);
    const allowSnap = isOptions ? options.allowSnap !== false : true;
    const forceSnap = isOptions ? Boolean(options.forceSnap) : false;
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
    const shouldSnap = forceSnap || (allowSnap && trajectoryState.snapEnabled && distanceSq <= trajectoryState.snapDistanceSq);

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
      if (allowSnap && trajectoryState.snapEnabled && trajectoryState.dragging) {
        stageY = applyPlatformMagnetism(stageX, stageY);
      }
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
      } else if (targetStateSelect) {
        const groundState = (state.lastGroundState && state.lastGroundState !== 'airborne')
          ? state.lastGroundState
          : 'standing';
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
    if (state.comboLockPosition) return;
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
    if (state.comboLockPosition) return;
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
