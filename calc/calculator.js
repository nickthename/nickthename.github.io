(function () {
  const f32 = Math.fround;

  const LV1 = 0.82;
  const LV2 = 0.89;
  const LV3 = 0.96;
  const STALE = 0.75;
  const CROUCH_MULTIPLIER = 0.66666667;
  const KNOCKBACK_CAP = 2500;
  const VELOCITY_DECAY_FACTOR = 1.7;
  const HITSTUN_DIVIDER = 0.5333333333333333; // 1 / 1.875
  const HITSTUN_FLOOR = 0.4999995000000001;
  const DOUBLE_JUMP_ARMOR_VALUE_U = 140;
  const DOUBLE_JUMP_ARMOR_VALUE_J = 110;
  const DOUBLE_JUMP_ARMOR_VALUES = { U: DOUBLE_JUMP_ARMOR_VALUE_U, J: DOUBLE_JUMP_ARMOR_VALUE_J };

  const GROUND_SPIKE_Y_DEC = {
    '-80': 1.6601531505584717,
    '-85': 1.6899244785308838,
    '-100': 1.6601531505584717,
  };

  const GROUND_SPIKE_X_DEC = {
    '-80': 0.36591216921806335,
    '-85': 0.18481168150901794,
    '-100': 0.36591222882270813,
  };

  const ATK_MULTIPLIERS = [
    1, 0.55, 0.6, 0.699999988079071, 0.75, 0.800000011920929, 0.8999999761581421,
    0.949999988079071, 1, 1.090000033378601, 0.5, 0.55, 0.6000000238418579,
    0.6499999761581421, 0.699999988079071, 0.75, 0.800000011920929,
    0.8500000238418579, 0.8999999761581421, 0.949999988079071,
    0.6499999761581421, 0.699999988079071, 0.7400000095367432,
    0.7699999809265137, 0.800000011920929, 1, 1.0499999523162842,
    1.100000023841858, 1.149999976158142, 1.2300000190734863,
    1.0499999523162842, 1.100000023841858, 1.149999976158142,
    1.2000000476837158, 1.25, 0.8999999761581421, 1, 1.100000023841858,
    1.2200000286102295, 1.5, 1.0800000429153442,
  ];

  const DEF_MULTIPLIERS = [
    1, 1.8181817531585693, 1.6666666269302368, 1.4285714626312256,
    1.3333333730697632, 1.25, 1.1111111640930176, 1.0526316165924072,
    1, 0.9174311757087708, 5, 4, 3.3333332538604736, 2.857142925262451,
    2.5, 1.8181817531585693, 1.6949152946472168, 1.5873016119003296,
    1.492537260055542, 1.408450722694397, 3.3333332538604736,
    2.857142925262451, 2.5, 2.222222328186035, 2, 0.5714285969734192,
    0.5376344323158264, 0.5128204822540283, 0.4761905074119568,
    0.45045045018196106, 0.43478262424468994, 0.4000000059604645,
    0.37037035822868347, 0.3571428656578064, 0.3333333432674408,
    1, 1, 1, 1, 1, 0.9259259104728699,
  ];

  const CHARACTERS = [
    { name: 'Luigi', key: 'Luigi', weight: 1.0, fallAccel: 2.1, maxFall: 42, traction: 0.7 },
    { name: 'Mario', key: 'Mario', weight: 1.0, fallAccel: 2.4, maxFall: 44, traction: 1.5 },
    { name: 'DK', key: 'DK', weight: 0.83, fallAccel: 3.0, maxFall: 56, traction: 1.7 },
    { name: 'Link', key: 'Link', weight: 0.96, fallAccel: 3.4, maxFall: 64, traction: 2.0 },
    { name: 'Samus', key: 'Samus', weight: 0.92, fallAccel: 1.9, maxFall: 42, traction: 2.0 },
    { name: 'Captain Falcon', key: 'Falcon', weight: 0.96, fallAccel: 3.4, maxFall: 66, traction: 1.8 },
    { name: 'Ness', key: 'Ness', weight: 1.1, fallAccel: 2.7, maxFall: 55, traction: 2.0 },
    { name: 'Yoshi', key: 'Yoshi', weight: 0.93, fallAccel: 2.8, maxFall: 58, traction: 1.6 },
    { name: 'Kirby', key: 'Kirby', weight: 1.19, fallAccel: 2.4, maxFall: 48, traction: 1.4 },
    { name: 'Fox', key: 'Fox', weight: 1.0, fallAccel: 4.0, maxFall: 60, traction: 2.0 },
    { name: 'Pikachu', key: 'Pikachu', weight: 1.16, fallAccel: 3.0, maxFall: 52, traction: 2.0 },
    { name: 'Jigglypuff', key: 'Jigglypuff', weight: 1.3, fallAccel: 2.0, maxFall: 38, traction: 1.1 },
  ];

  const CHARACTERS_J = [
    { name: 'Luigi', key: 'Luigi', weight: 1.0, fallAccel: 2.1, maxFall: 42, traction: 0.7 },
    { name: 'Mario', key: 'Mario', weight: 1.0, fallAccel: 2.4, maxFall: 44, traction: 1.5 },
    { name: 'DK', key: 'DK', weight: 0.84, fallAccel: 3.0, maxFall: 56, traction: 1.7 },
    { name: 'Link', key: 'Link', weight: 0.96, fallAccel: 3.2, maxFall: 64, traction: 2.0 },
    { name: 'Samus', key: 'Samus', weight: 0.92, fallAccel: 1.9, maxFall: 42, traction: 2.0 },
    { name: 'Captain Falcon', key: 'Falcon', weight: 0.96, fallAccel: 3.4, maxFall: 60, traction: 1.8 },
    { name: 'Ness', key: 'Ness', weight: 1.1, fallAccel: 2.7, maxFall: 55, traction: 2.0 },
    { name: 'Yoshi', key: 'Yoshi', weight: 0.93, fallAccel: 2.7, maxFall: 55, traction: 1.6 },
    { name: 'Kirby', key: 'Kirby', weight: 1.19, fallAccel: 2.4, maxFall: 48, traction: 1.4 },
    { name: 'Fox', key: 'Fox', weight: 1.0, fallAccel: 4.0, maxFall: 60, traction: 2.0 },
    { name: 'Pikachu', key: 'Pikachu', weight: 1.16, fallAccel: 3.0, maxFall: 52, traction: 2.0 },
    { name: 'Jigglypuff', key: 'Jigglypuff', weight: 1.3, fallAccel: 2.0, maxFall: 38, traction: 1.1 },
  ];

  const normalizeVersion = (value) => (String(value || '').toUpperCase() === 'J' ? 'J' : 'U');

  let currentVersion = 'U';
  let currentCharacters = CHARACTERS;
  let currentDoubleJumpArmorValue = DOUBLE_JUMP_ARMOR_VALUES[currentVersion];

  function setVersion(version) {
    currentVersion = normalizeVersion(version);
    currentCharacters = currentVersion === 'J' ? CHARACTERS_J : CHARACTERS;
    currentDoubleJumpArmorValue = DOUBLE_JUMP_ARMOR_VALUES[currentVersion];

    if (window.Smash64Calculator) {
      window.Smash64Calculator.currentVersion = currentVersion;
      window.Smash64Calculator.characters = currentCharacters;
      window.Smash64Calculator.doubleJumpArmorValue = currentDoubleJumpArmorValue;
    }

    return currentVersion;
  }

  function approxEqual(a, b, epsilon = 1e-6) {
    return Math.abs(a - b) <= epsilon;
  }

  function deriveSpikeMode(angleDeg, targetState) {
    if (!(Number.isFinite(angleDeg)) || angleDeg >= 0) {
      return 'off';
    }

    if (targetState === 'airborne') {
      return 'air';
    }

    if (targetState === 'standing' || targetState === 'crouching' || targetState === 'laying') {
      return 'ground';
    }

    return 'off';
  }

  function roundToNearestEven(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const sign = Math.sign(value) || 1;
    const absValue = Math.abs(value);
    const base = Math.floor(absValue);
    const fractional = absValue - base;
    const EPS = 1e-7;
    if (fractional > 0.5 + EPS) {
      return sign * (base + 1);
    }
    if (fractional < 0.5 - EPS) {
      return sign * base;
    }
    // halfway case: choose the even integer
    const candidate = base + (base % 2 === 0 ? 0 : 1);
    return sign * candidate;
  }

  function applyStaleness(baseDamage, modifier) {
    const dmg = Math.max(0, Math.trunc(Number(baseDamage) || 0));
    switch (modifier) {
      case 'lv1':
        return Math.ceil(dmg * LV1);
      case 'lv2':
        return Math.ceil(dmg * LV2);
      case 'lv3':
        return Math.ceil(dmg * LV3);
      case 'stale':
        return Math.floor((3 * dmg + (dmg & 3)) / 4); // mirrors the integer math in the original
      default:
        return dmg;
    }
  }

  function computeShieldDamage(baseDamage, damageModifier, extraShieldDamage = 0) {
    const staledDamage = applyStaleness(baseDamage, damageModifier);
    const bonus = Number.isFinite(extraShieldDamage) ? Math.trunc(extraShieldDamage) : 0;
    return staledDamage + bonus;
  }

  function computeShieldstun(damage) {
    const baseDamage = Math.max(0, Math.trunc(Number(damage) || 0));
    const multiplier = currentVersion === 'J' ? 1.75 : 1.62;
    return Math.ceil(baseDamage * multiplier + 3);
  }

  function getHitlagBonus() {
    return currentVersion === 'J' ? 4 : 5;
  }

  function hitlagForCrouch(damage, electric) {
    const base = Math.floor(damage / 3);
    const bonus = getHitlagBonus();
    if (electric) {
      const value = base + bonus;
      return value & ~1; // round down to the nearest even value
    }
    const scaled = Math.floor((base * 2 + bonus * 2) / 3);
    return scaled;
  }

  function computeHitlag(damage, state, electric) {
    const dmg = Math.max(0, Math.trunc(damage));
    if (state === 'laying') {
      const extra = Math.ceil(dmg / 2);
      const base = Math.floor(extra / 3) + getHitlagBonus();
      return electric ? Math.floor(base * 1.5) : base;
    }
    if (state === 'crouching') {
      return hitlagForCrouch(dmg, electric);
    }
    let base = Math.floor(dmg / 3) + getHitlagBonus();
    if (electric) {
      base = Math.floor(base * 1.5);
    }
    return base;
  }

  function applyGroundFriction(velocity, friction) {
    let next = f32(velocity);
    if (next < 0.0) {
      next = f32(next + friction);
      if (next > 0.0) next = 0.0;
    } else {
      next = f32(next - friction);
      if (next < 0.0) next = 0.0;
    }
    return next;
  }

  function simulateKnockbackSteps(config) {
    const totalFrames = Math.max(Math.trunc(config.totalFrames) || 0, 0);
    const steps = [{ frame: 0, x: 0, y: 0 }];
    if (totalFrames <= 0) {
      return { steps, landingFrame: null, landed: false };
    }

    let xVelocity = f32(config.initialVX);
    let yVelocity = f32(config.initialVY);
    let xDistance = f32(0);
    let yDistance = f32(0);
    let fall = f32(0);
    let yVelocityCurrent = yVelocity;
    let landed = false;
    let landingFrame = null;

    const xDec = f32(config.xDec);
    const yDec = f32(config.yDec);
    const fallAccel = f32(config.fallAccel);
    const maxFall = f32(config.maxFall);
    const spikeMode = config.spikeMode;
    const startX = Number.isFinite(config.startX) ? Number(config.startX) : 0;
    const startY = Number.isFinite(config.startY) ? Number(config.startY) : 0;
    const groundY = Number.isFinite(config.groundY) ? Number(config.groundY) : 0;
    const traction = Math.max(0, Number(config.traction) || 0);
    const stopOnLanding = Boolean(config.stopOnLanding);
    const planes = Array.isArray(config.groundPlanes) ? config.groundPlanes : [];
    const groundPlanes = planes
      .map((plane) => ({
        y: Number(plane.y),
        xMin: Number(plane.xMin),
        xMax: Number(plane.xMax),
      }))
      .filter((plane) => Number.isFinite(plane.y) && Number.isFinite(plane.xMin) && Number.isFinite(plane.xMax));
    if (groundPlanes.length === 0 && Number.isFinite(groundY)) {
      groundPlanes.push({ y: groundY, xMin: -Infinity, xMax: Infinity });
    }
    let activeGroundPlane = null;

    if (spikeMode !== 'air') {
      yVelocityCurrent = f32(yVelocityCurrent - yDec);
    }

    for (let frame = 1; frame <= totalFrames; frame += 1) {
      const prevAbsY = startY + yDistance;
      if (!landed) {
        const prevAbsX = startX + xDistance;
        if (Math.abs(xVelocity) > xDec) {
          const xSign = Math.sign(xVelocity) || 1;
          xVelocity = f32(xVelocity - (xDec * xSign));
          if (Math.sign(xVelocity) !== xSign) {
            xVelocity = f32(0);
          }
          xDistance = f32(xDistance + xVelocity);
        }

        if (spikeMode === 'air') {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yVelocityCurrent = f32(yVelocityCurrent - yDec);
          yDistance = f32(yDistance + yVelocityCurrent + fall);
        } else {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yDistance = f32(yDistance + (yVelocityCurrent - fall));
          const nextVelocity = f32(yVelocityCurrent - yDec);
          yVelocityCurrent = nextVelocity > 0 ? nextVelocity : 0;
        }

        const newAbsX = startX + xDistance;
        const newAbsY = startY + yDistance;
        if (groundPlanes.length > 0) {
          let candidate = null;
          for (let i = 0; i < groundPlanes.length; i += 1) {
            const plane = groundPlanes[i];
            if (prevAbsY <= plane.y || newAbsY > plane.y) continue;
            if (newAbsX < plane.xMin || newAbsX > plane.xMax) continue;
            if (!candidate || plane.y > candidate.y) {
              candidate = plane;
            }
          }
          if (candidate) {
            landed = true;
            landingFrame = frame;
            activeGroundPlane = candidate;
            yDistance = f32(candidate.y - startY);
            if (stopOnLanding) {
              steps.push({ frame, x: Number(xDistance), y: Number(yDistance) });
              break;
            }
            yVelocityCurrent = 0;
            fall = f32(0);
          }
        }
      } else {
        if (traction > 0) {
          xVelocity = applyGroundFriction(xVelocity, traction);
        } else {
          xVelocity = 0;
        }
        xDistance = f32(xDistance + xVelocity);
        if (activeGroundPlane) {
          yDistance = f32(activeGroundPlane.y - startY);
          const absX = startX + xDistance;
          if (absX < activeGroundPlane.xMin || absX > activeGroundPlane.xMax) {
            landed = false;
            activeGroundPlane = null;
            yVelocityCurrent = 0;
            fall = f32(0);
          }
        }
      }

      steps.push({ frame, x: Number(xDistance), y: Number(yDistance) });
    }

    return { steps, landingFrame, landed };
  }

  function simulateHitstunTrajectory(config) {
    return simulateKnockbackSteps({
      totalFrames: config.hitstun,
      initialVX: config.initialVX,
      initialVY: config.initialVY,
      xDec: config.xDec,
      yDec: config.yDec,
      fallAccel: config.fallAccel,
      maxFall: config.maxFall,
      spikeMode: config.spikeMode,
      startX: config.startX,
      startY: config.startY,
      groundY: config.groundY,
      traction: config.traction,
      groundPlanes: config.groundPlanes,
      stopOnLanding: config.stopOnLanding,
    });
  }

  function computeKnockback(params) {
    const weight = Number(params.weight) || 1;
    const fallAccel = f32(Number(params.fallAccel) || 0);
    const maxFall = f32(Number(params.maxFall) || 0);
    const baseDamage = params.baseDamage;
    const baseKnockback = Math.max(0, Number(params.baseKnockback) || 0);
    const knockbackScaling = Math.max(0, Number(params.knockbackScaling) || 0);
    const fixedKnockback = Math.max(0, Number(params.fixedKnockback) || 0);
    const attackHandicapIndex = Math.min(40, Math.max(0, Math.trunc(params.attackHandicapIndex)));
    const defenseHandicapIndex = Math.min(40, Math.max(0, Math.trunc(params.defenseHandicapIndex)));
    const damageModifier = params.damageModifier;
    const targetState = params.targetState;
    const electric = Boolean(params.electric);
    const simulationMode = params.simulationMode;
    const comboDelay = Math.max(0, Math.trunc(Number(params.comboDelay) || 0));
    const throwMove = Boolean(params.throwMove);
    const doubleJumpArmor = Boolean(params.doubleJumpArmor);
    const attackDirection = params.attackDirection === 'left' ? 'left' : 'right';
    const attackDirectionSign = attackDirection === 'left' ? -1 : 1;
    const startX = Number.isFinite(params.startX) ? Number(params.startX) : 0;
    const startY = Number.isFinite(params.startY) ? Number(params.startY) : 0;
    const groundY = Number.isFinite(params.groundY) ? Number(params.groundY) : 0;
    const traction = Math.max(0, Number(params.traction) || 0);
    const groundPlanes = Array.isArray(params.groundPlanes) ? params.groundPlanes : [];

    const baseDamageInt = Math.max(0, Math.trunc(Number(baseDamage) || 0));
    let damage = applyStaleness(baseDamage, damageModifier);
    let damageForKnockback = throwMove ? baseDamageInt : damage;
    let hpForKnockback = Math.max(0, Math.trunc(Number(params.hp) || 0));

    let hitlag = 0;

    const treatAsLaying = (targetState === 'laying') && !throwMove;

    if (treatAsLaying) {
      const extraApplied = Math.ceil(damage / 2);
      const extraForKnockback = Math.ceil(damageForKnockback / 2);
      hpForKnockback += extraForKnockback;
      const base = Math.floor(extraApplied / 3) + getHitlagBonus();
      hitlag = electric ? Math.floor(base * 1.5) : base;
    } else {
      hpForKnockback += damageForKnockback;
    }

    if (fixedKnockback > 0) {
      hpForKnockback = 10;
      damage = Math.trunc(fixedKnockback);
      damageForKnockback = damage;
    }

    const attackMultiplier = f32(ATK_MULTIPLIERS[attackHandicapIndex] ?? 1);
    const defenseMultiplier = f32(DEF_MULTIPLIERS[defenseHandicapIndex] ?? 1);

    let knockback = f32(
      f32(
        f32(
          f32(
            f32((hpForKnockback * 0.1) + (damageForKnockback * hpForKnockback * 0.05)) * weight
          ) * 1.4
        ) + 18
      ) * (knockbackScaling * 0.01)
    );
    knockback = f32(knockback + baseKnockback);
    knockback = f32(knockback * attackMultiplier);
    knockback = f32(knockback * defenseMultiplier);
    knockback = Math.min(knockback, KNOCKBACK_CAP);

    if (targetState === 'crouching' && !throwMove) {
      knockback = f32(knockback * CROUCH_MULTIPLIER);
    }

    if (targetState !== 'laying' || throwMove) {
      hitlag = computeHitlag(damage, targetState, electric);
    }

    const knockbackBeforeArmor = knockback;

    if (doubleJumpArmor && !throwMove) {
      const adjusted = knockbackBeforeArmor - currentDoubleJumpArmorValue;
      knockback = f32(Math.max(0, adjusted));
    }

    const rawHitstun = knockback * HITSTUN_DIVIDER - HITSTUN_FLOOR;
    const hitstun = Math.max(0, roundToNearestEven(rawHitstun));
    const isKnockdown = hitstun >= 32;

    const rawAngleDeg = Number(params.angle) || 0;
    let angleDeg = rawAngleDeg;
    if (Math.abs(rawAngleDeg - 361) < 1e-6) {
      if (targetState === 'airborne') {
        angleDeg = 43;
      } else {
        angleDeg = knockback < 32 ? 0 : 42.5;
      }
    }

    const spikeMode = deriveSpikeMode(angleDeg, targetState);

    const angleRad = angleDeg * (Math.PI / 180);
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);
    const horizontalDirection = approxEqual(cosAngle, 0)
      ? 0
      : (cosAngle > 0 ? 1 : -1);
    const signedHorizontalDirection = horizontalDirection === 0 ? 0 : horizontalDirection * attackDirectionSign;
    const verticalDirection = approxEqual(sinAngle, 0)
      ? 0
      : (sinAngle > 0 ? 1 : -1);

    let yMultiplier = f32(Math.abs(sinAngle));
    let xMultiplier = f32(Math.abs(cosAngle));

    if (approxEqual(Math.abs(angleDeg), 90)) {
      xMultiplier = 0;
    }

    let yDec = f32(VELOCITY_DECAY_FACTOR * yMultiplier);
    let xDecOverride = null;

    const isGroundSpike = spikeMode === 'ground' && angleDeg < 0;

    if (isGroundSpike) {
      if (hitstun < 32) {
        return {
          damage,
          knockback,
          hitlag,
          hitstun,
          attackMultiplier,
          defenseMultiplier,
          initialVelocityX: 0,
          initialVelocityY: 0,
          totalDistanceX: 0,
          totalDistanceY: 0,
          trajectory: [{ frame: 0, x: 0, y: 0 }],
          horizontalDirection,
          verticalDirection: 1,
          resolvedAngle: angleDeg,
          knockbackBeforeArmor,
        };
      }
      yMultiplier = f32(yMultiplier * 0.8);
      const roundedAngle = String(Math.round(angleDeg));
      if (GROUND_SPIKE_Y_DEC[roundedAngle]) {
        yDec = f32(GROUND_SPIKE_Y_DEC[roundedAngle]);
        xDecOverride = f32(GROUND_SPIKE_X_DEC[roundedAngle]);
      }
    }

    const xDec = xDecOverride ?? f32(VELOCITY_DECAY_FACTOR * xMultiplier);
    const initialVelocityY = f32(yMultiplier * knockback);
    const initialVelocityX = f32(xMultiplier * knockback * signedHorizontalDirection);

    const stopOnLanding = isKnockdown;
    const trajectoryResult = simulateHitstunTrajectory({
      hitstun,
      initialVX: initialVelocityX,
      initialVY: initialVelocityY,
      xDec,
      yDec,
      fallAccel,
      maxFall,
      spikeMode,
      startX,
      startY,
      groundY,
      traction,
      groundPlanes,
      stopOnLanding,
    });
    const trajectory = trajectoryResult.steps;
    const simulatedHitstun = stopOnLanding && trajectoryResult.landingFrame !== null
      ? trajectoryResult.landingFrame
      : hitstun;

    let fall = f32(0);
    let xVelocity = initialVelocityX;
    let yVelocity = initialVelocityY;
    let xDistance = f32(0);
    let yDistance = f32(0);

    const runHitstunSimulation = simulationMode === 'hitstun' || simulationMode === 'custom';
    const frameLimit = comboDelay > 0 ? Math.max(0, comboDelay - 1) : hitstun;

    if (runHitstunSimulation) {
      const simResult = simulateKnockbackSteps({
        totalFrames: frameLimit,
        initialVX: initialVelocityX,
        initialVY: initialVelocityY,
        xDec,
        yDec,
        fallAccel,
        maxFall,
        spikeMode,
        startX,
        startY,
        groundY,
        traction,
        groundPlanes,
        stopOnLanding,
      });
      const lastStep = simResult.steps[simResult.steps.length - 1];
      xDistance = f32(lastStep ? lastStep.x : 0);
      yDistance = f32(lastStep ? lastStep.y : 0);
    } else {
      while (Math.abs(xVelocity) > xDec) {
        const xSign = Math.sign(xVelocity) || 1;
        xVelocity = f32(xVelocity - (xDec * xSign));
        if (Math.sign(xVelocity) !== xSign) {
          xVelocity = f32(0);
        }
        xDistance = f32(xDistance + xVelocity);
      }

      if (spikeMode === 'air') {
        while (yVelocity > yDec) {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yVelocity = f32(yVelocity - yDec);
          yDistance = f32(yDistance + yVelocity + fall);
        }
      } else {
        yVelocity = f32(yVelocity - yDec);
        while (yVelocity > 0 || fall < maxFall) {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yDistance = f32(yDistance + (yVelocity - fall));
          const nextVelocity = f32(yVelocity - yDec);
          yVelocity = nextVelocity > 0 ? nextVelocity : f32(0);

          if (yVelocity === 0 && fall === maxFall) {
            break;
          }
        }
      }
    }

    return {
      damage,
      knockback,
      hitlag,
      hitstun,
      simulatedHitstun,
      attackMultiplier,
      defenseMultiplier,
      initialVelocityX: Number(initialVelocityX),
      initialVelocityY: Number(initialVelocityY),
      totalDistanceX: Number(xDistance),
      totalDistanceY: Number(yDistance),
      trajectory,
      horizontalDirection: signedHorizontalDirection,
      verticalDirection: isGroundSpike ? 1 : verticalDirection,
      resolvedAngle: angleDeg,
      knockbackBeforeArmor,
    };
  }

  window.Smash64Calculator = {
    characters: currentCharacters,
    charactersByVersion: { U: CHARACTERS, J: CHARACTERS_J },
    attackMultipliers: ATK_MULTIPLIERS,
    defenseMultipliers: DEF_MULTIPLIERS,
    compute: computeKnockback,
    applyStaleness,
    computeShieldDamage,
    computeShieldstun,
    doubleJumpArmorValue: currentDoubleJumpArmorValue,
    doubleJumpArmorValues: { ...DOUBLE_JUMP_ARMOR_VALUES },
    currentVersion,
    getVersion: () => currentVersion,
    setVersion,
  };
})();
