(() => {
  const app = window.CalcApp = window.CalcApp || {};
  const config = window.CALC_CONFIG || {};

  app.config = config;
  app.UI_TEXT = window.CALC_I18N || {};
  app.PAGE_LANGUAGE = config.pageLanguage || 'en';
  app.LANGUAGE_PATHS = config.languagePaths || { en: '/calc/', ja: '/ja/calc/' };
  app.LOCAL_STORAGE_LANGUAGE_KEY = config.localStorageLanguageKey || 'smash64:lang';
  app.CHARACTER_ICONS = config.characterIcons || {};
  app.MOVESET_FILES = config.movesetFiles || { U: '/calc/movesets.json', J: '/calc/j_movesets.json' };
  app.MOVE_LABELS_FILE = config.moveLabelFile || '/calc/move-labels.json';

  app.elements = {
    form: document.getElementById('calculator-form'),
    defenderSelect: document.getElementById('defender-select'),
    attackerSelect: document.getElementById('attacker-select'),
    moveSelect: document.getElementById('move-select'),
    moveDetails: document.getElementById('move-details'),
    stalenessControl: document.getElementById('staleness-control'),
    weightInput: document.getElementById('weight-input'),
    fallAccelInput: document.getElementById('fall-accel-input'),
    maxFallInput: document.getElementById('max-fall-input'),
    hpInput: document.getElementById('hp-input'),
    damageInput: document.getElementById('damage-input'),
    angleInput: document.getElementById('angle-input'),
    kbsInput: document.getElementById('kbs-input'),
    bkbInput: document.getElementById('bkb-input'),
    fkbInput: document.getElementById('fkb-input'),
    stalenessButtons: Array.from(document.querySelectorAll('[data-staleness]')),
    cameraButtons: Array.from(document.querySelectorAll('[data-camera-mode]')),
    electricToggle: document.getElementById('electric-toggle'),
    throwToggle: document.getElementById('throw-toggle'),
    targetStateSelect: document.getElementById('target-state-select'),
    attackDirectionButtons: Array.from(document.querySelectorAll('[data-attack-direction]')),
    simulationSelect: document.getElementById('simulation-select'),
    comboDelayInput: document.getElementById('combo-delay-input'),
    comboDelayRow: document.getElementById('combo-delay-row'),
    attackHandicapInput: document.getElementById('attack-handicap-input'),
    defenseHandicapInput: document.getElementById('defense-handicap-input'),
    positionHorizontalSelect: document.getElementById('position-horizontal'),
    positionVerticalSelect: document.getElementById('position-vertical'),
    positionXInput: document.getElementById('position-x-input'),
    positionYInput: document.getElementById('position-y-input'),
    debugToggle: document.getElementById('debug-toggle'),
    snapToggle: document.getElementById('snap-toggle'),
    doubleJumpArmorRow: document.getElementById('double-jump-armor-row'),
    doubleJumpArmorToggle: document.getElementById('double-jump-armor-toggle'),
    languageSelect: document.getElementById('language-select'),
    versionSelect: document.getElementById('version-select'),
    versionSelectorRoot: document.querySelector('[data-version-language-selector]'),
    copyLinkButton: document.getElementById('copy-link-button'),
    resetButton: document.getElementById('reset-button'),
    backgroundSelector: document.querySelector('[data-bg-selector]'),
    backgroundToggle: document.querySelector('[data-bg-toggle]'),
    backgroundMenu: document.getElementById('bg-menu'),
    backgroundOptions: Array.from(document.querySelectorAll('[data-bg-option]')),
    comboStrip: document.getElementById('combo-strip'),
  };

  app.outputNodes = {
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
    shieldDamage: document.getElementById('shield-damage-output'),
    shieldstun: document.getElementById('shieldstun-output'),
  };

  app.constants = {
    BLASTZONE_LIMITS: { left: -9000, right: 9000, bottom: -3500, top: 8300 },
    POSITION_DATA: {
      stage: { y: 0, center: 0, halfWidth: 2318 },
      'left-platform': { y: 904, center: -1396, halfWidth: 445 },
      'right-platform': { y: 907, center: 1421.5, halfWidth: 470.5 },
      'top-platform': { y: 1542, center: 0, halfWidth: 570 },
    },
    STAGE_VIEW_MARGIN_X: 420,
    STAGE_VIEW_TOP_MARGIN: 1800,
    STAGE_VIEW_BOTTOM_MARGIN: 420,
    BLASTZONE_MARGIN: 200,
    WORLD_EXTENT: 40000,
    LIVE_AREA_MARGIN: 1,
    DOUBLE_JUMP_ARMOR_LIFT: 160,
  };

  app.trajectoryElements = {
    svg: document.getElementById('trajectory-svg'),
    path: document.getElementById('trajectory-path'),
    pointsGroup: document.getElementById('trajectory-points'),
    start: document.getElementById('trajectory-start'),
    end: document.getElementById('trajectory-end'),
    killMarker: document.getElementById('trajectory-kill-marker'),
    blastzone: document.getElementById('trajectory-blastzone'),
    blastzoneOutside: document.getElementById('trajectory-blastzone-outside'),
    sky: document.getElementById('trajectory-sky'),
    stageImage: document.getElementById('trajectory-stage-image'),
    stageImageBlur: document.getElementById('trajectory-stage-image-blur'),
    stage: {
      ground: document.getElementById('trajectory-stage-ground'),
      left: document.getElementById('trajectory-stage-left'),
      right: document.getElementById('trajectory-stage-right'),
      top: document.getElementById('trajectory-stage-top'),
    },
  };

  app.trajectoryState = {
    viewBox: { minX: -2500, minY: -2000, width: 5000, height: 4000 },
    dragging: false,
    pointerId: null,
    cameraMode: 'fit',
    snapEnabled: true,
    snapDistanceSq: 130 * 130,
    pendingFitBounds: null,
  };
})();
