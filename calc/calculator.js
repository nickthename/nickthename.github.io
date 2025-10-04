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
  const DOUBLE_JUMP_ARMOR_VALUE = 140;

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
    { name: 'Mario', key: 'Mario', weight: 1.0, fallAccel: 2.4, maxFall: 44 },
    { name: 'Fox', key: 'Fox', weight: 1.0, fallAccel: 4.0, maxFall: 60 },
    { name: 'DK', key: 'DK', weight: 0.83, fallAccel: 3.0, maxFall: 56 },
    { name: 'Samus', key: 'Samus', weight: 0.92, fallAccel: 1.9, maxFall: 42 },
    { name: 'Luigi', key: 'Luigi', weight: 1.0, fallAccel: 2.1, maxFall: 42 },
    { name: 'Link', key: 'Link', weight: 0.96, fallAccel: 3.4, maxFall: 64 },
    { name: 'Yoshi', key: 'Yoshi', weight: 0.93, fallAccel: 2.8, maxFall: 58 },
    { name: 'Falcon', key: 'Falcon', weight: 0.96, fallAccel: 3.4, maxFall: 66 },
    { name: 'Kirby', key: 'Kirby', weight: 1.19, fallAccel: 2.4, maxFall: 48 },
    { name: 'Pikachu', key: 'Pikachu', weight: 1.16, fallAccel: 3.0, maxFall: 52 },
    { name: 'Jigglypuff', key: 'Jigglypuff', weight: 1.3, fallAccel: 2.0, maxFall: 38 },
    { name: 'Ness', key: 'Ness', weight: 1.1, fallAccel: 2.7, maxFall: 55 },
  ];

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

  function hitlagForCrouch(damage, electric) {
    const base = Math.floor(damage / 3);
    if (electric) {
      const value = base + 5;
      return value & ~1; // round down to the nearest even value
    }
    const scaled = Math.floor((base * 2 + 10) / 3);
    return scaled;
  }

  function computeHitlag(damage, state, electric) {
    const dmg = Math.max(0, Math.trunc(damage));
    if (state === 'laying') {
      const extra = Math.ceil(dmg / 2);
      const base = Math.floor(extra / 3) + 5;
      return electric ? Math.floor(base * 1.5) : base;
    }
    if (state === 'crouching') {
      return hitlagForCrouch(dmg, electric);
    }
    let base = Math.floor(dmg / 3) + 5;
    if (electric) {
      base = Math.floor(base * 1.5);
    }
    return base;
  }

  function simulateHitstunTrajectory(config) {
    const totalFrames = Math.max(Math.trunc(config.hitstun) || 0, 0);
    const steps = [{ frame: 0, x: 0, y: 0 }];
    if (totalFrames <= 0) {
      return steps;
    }

    let xVelocity = f32(config.initialVX);
    let yVelocity = f32(config.initialVY);
    let xDistance = f32(0);
    let yDistance = f32(0);
    let fall = f32(0);
    let yVelocityCurrent = yVelocity;

    const xDec = f32(config.xDec);
    const yDec = f32(config.yDec);
    const fallAccel = f32(config.fallAccel);
    const maxFall = f32(config.maxFall);
    const spikeMode = config.spikeMode;

    const xIterations = Math.max(totalFrames - 1, 0);
    let xIterationCount = 0;

    let remainingYIterations = Math.max(totalFrames - 1, 0);
    let stopYAxis = false;

    if (remainingYIterations > 0 && spikeMode !== 'air') {
      yVelocityCurrent = f32(yVelocityCurrent - yDec);
    }

    for (let frame = 1; frame <= totalFrames; frame += 1) {
      if (xIterationCount < xIterations && xVelocity > xDec) {
        xVelocity = f32(xVelocity - xDec);
        xDistance = f32(xDistance + xVelocity);
        xIterationCount += 1;
      }

      if (!stopYAxis && remainingYIterations > 0) {
        if (spikeMode === 'air') {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yVelocityCurrent = f32(yVelocityCurrent - yDec);
          yDistance = f32(yDistance + yVelocityCurrent + fall);
          remainingYIterations -= 1;
        } else {
          if (yVelocityCurrent <= fall) {
            stopYAxis = true;
            remainingYIterations = 0;
          } else {
            fall = f32(fall + fallAccel);
            if (fall > maxFall) {
              fall = maxFall;
            }
            yDistance = f32(yDistance + (yVelocityCurrent - fall));
            yVelocityCurrent = f32(yVelocityCurrent - yDec);
            remainingYIterations -= 1;
          }
        }
      }

      steps.push({ frame, x: Number(xDistance), y: Number(yDistance) });
    }

    return steps;
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
      const base = Math.floor(extraApplied / 3) + 5;
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
      const adjusted = knockbackBeforeArmor - DOUBLE_JUMP_ARMOR_VALUE;
      knockback = f32(Math.max(0, adjusted));
    }

    const rawHitstun = knockback * HITSTUN_DIVIDER - HITSTUN_FLOOR;
    const hitstun = Math.max(0, roundToNearestEven(rawHitstun));

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
    const initialVelocityX = f32(xMultiplier * knockback);

    const trajectory = simulateHitstunTrajectory({
      hitstun,
      initialVX: initialVelocityX,
      initialVY: initialVelocityY,
      xDec,
      yDec,
      fallAccel,
      maxFall,
      spikeMode,
    });

    let fall = f32(0);
    let xVelocity = initialVelocityX;
    let yVelocity = initialVelocityY;
    let xDistance = f32(0);
    let yDistance = f32(0);

    const runHitstunSimulation = simulationMode === 'hitstun' || simulationMode === 'custom';
    const frames = comboDelay > 0 ? comboDelay : hitstun;

    if (runHitstunSimulation) {
      let xFrames = Math.max(frames - 1, 0);
      while (xFrames > 0 && xVelocity > xDec) {
        xVelocity = f32(xVelocity - xDec);
        xDistance = f32(xDistance + xVelocity);
        xFrames -= 1;
      }

      let yFrames = Math.max(frames - 1, 0);
      if (spikeMode === 'air') {
        while (yFrames > 0) {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yVelocity = f32(yVelocity - yDec);
          yDistance = f32(yDistance + yVelocity + fall);
          yFrames -= 1;
        }
      } else {
        yVelocity = f32(yVelocity - yDec);
        while (yFrames > 0) {
          if (yVelocity <= fall) {
            break;
          }
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yDistance = f32(yDistance + (yVelocity - fall));
          yVelocity = f32(yVelocity - yDec);
          yFrames -= 1;
        }
      }
    } else {
      while (xVelocity > xDec) {
        xVelocity = f32(xVelocity - xDec);
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
        while (yVelocity > fall) {
          fall = f32(fall + fallAccel);
          if (fall > maxFall) {
            fall = maxFall;
          }
          yDistance = f32(yDistance + (yVelocity - fall));
          yVelocity = f32(yVelocity - yDec);
        }
      }
    }

    return {
      damage,
      knockback,
      hitlag,
      hitstun,
      attackMultiplier,
      defenseMultiplier,
      initialVelocityX: Number(initialVelocityX),
      initialVelocityY: Number(initialVelocityY),
      totalDistanceX: Number(xDistance),
      totalDistanceY: Number(yDistance),
      trajectory,
      horizontalDirection,
      verticalDirection: isGroundSpike ? 1 : verticalDirection,
      resolvedAngle: angleDeg,
      knockbackBeforeArmor,
    };
  }

  window.Smash64Calculator = {
    characters: CHARACTERS,
    attackMultipliers: ATK_MULTIPLIERS,
    defenseMultipliers: DEF_MULTIPLIERS,
    compute: computeKnockback,
    applyStaleness,
    doubleJumpArmorValue: DOUBLE_JUMP_ARMOR_VALUE,
  };
})();
