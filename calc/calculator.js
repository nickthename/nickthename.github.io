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
    const spikeMode = params.spikeMode;
    const simulationMode = params.simulationMode;
    const comboDelay = Math.max(0, Math.trunc(Number(params.comboDelay) || 0));

    let damage = applyStaleness(baseDamage, damageModifier);
    let hp = Math.max(0, Math.trunc(Number(params.hp) || 0));

    let hitlag = 0;

    if (targetState === 'laying') {
      const extra = Math.ceil(damage / 2);
      hp += extra;
      const base = Math.floor(extra / 3) + 5;
      hitlag = electric ? Math.floor(base * 1.5) : base;
    } else {
      hp += damage;
    }

    if (fixedKnockback > 0) {
      hp = 10;
      damage = Math.trunc(fixedKnockback);
    }

    const attackMultiplier = f32(ATK_MULTIPLIERS[attackHandicapIndex] ?? 1);
    const defenseMultiplier = f32(DEF_MULTIPLIERS[defenseHandicapIndex] ?? 1);

    let knockback = f32(
      f32(
        f32(
          f32(
            f32((hp * 0.1) + (damage * hp * 0.05)) * weight
          ) * 1.4
        ) + 18
      ) * (knockbackScaling * 0.01)
    );
    knockback = f32(knockback + baseKnockback);
    knockback = f32(knockback * attackMultiplier);
    knockback = f32(knockback * defenseMultiplier);
    knockback = Math.min(knockback, KNOCKBACK_CAP);

    if (targetState === 'crouching') {
      knockback = f32(knockback * CROUCH_MULTIPLIER);
    }

    if (targetState !== 'laying') {
      hitlag = computeHitlag(damage, targetState, electric);
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

    const angleRad = angleDeg * (Math.PI / 180);
    let yMultiplier = f32(Math.abs(Math.sin(angleRad)));
    let xMultiplier = f32(Math.abs(Math.cos(angleRad)));

    if (approxEqual(Math.abs(angleDeg), 90)) {
      xMultiplier = 0;
    }

    let yDec = f32(VELOCITY_DECAY_FACTOR * yMultiplier);
    let xDecOverride = null;

    if (spikeMode === 'ground' && angleDeg < 0) {
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

    let fall = f32(0);
    let xVelocity = initialVelocityX;
    let yVelocity = initialVelocityY;
    let xDistance = f32(0);
    let yDistance = f32(0);

    const runHitstunSimulation = simulationMode === 'hitstun';
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
    };
  }

  window.Smash64Calculator = {
    characters: CHARACTERS,
    attackMultipliers: ATK_MULTIPLIERS,
    defenseMultipliers: DEF_MULTIPLIERS,
    compute: computeKnockback,
    applyStaleness,
  };
})();
