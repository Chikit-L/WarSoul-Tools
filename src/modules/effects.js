export const effects = {
  // 分裂
  'split': (stats, effectData) => {
    const splitRate = effectData.rate * (1 + stats.splitRune) / 100;
    stats.split = stats.split + splitRate * effectData.value;
  },
  // 重击
  'thump': (stats, effectData) => {
    stats.thump = stats.thump + effectData.rate / 100 * effectData.value
  },
  // 残忍
  'cruel': (stats, effectData) => {
    stats.cruel = stats.cruel + (effectData?.value || 0) + stats.cruelRune
    stats.cruelRatio = stats.cruelRatio + (effectData?.multiplier || 0) + stats.cruelRatioRune
  },
  // 轻灵
  'swiftness': (stats, effectData) => {
    stats.swiftness += (effectData.value - 1) + stats.swiftnessRune
  },
  // 爆发
  'burst': (stats, effectData) => {
    stats.burst += effectData.rate;
  },
}

export const segmentEffects = {
  // 收割
  'harvest': (segment) => ({
    hpPercentType: 'below',
    harvestRatio: (segment.multiplier || 0) * (1 + (segment.extraMultiplier || 0)),
    harvest: (segment.value || 0) * (1 + (segment.extraMultiplier || 0))
  }),
  // 冲击
  'impact': (segment) => ({
    hpPercentType: 'above',
    impactRatio: (segment.multiplier || 0) * (1 + (segment.extraMultiplier || 0)),
    impact: (segment.value || 0) * (1 + (segment.extraMultiplier || 0))
  }),
  // 冲锋
  'assault': (segment) => ({
    hpPercentType: 'above',
    assault: (segment.multiplier || 0) * (1 + (segment.extraMultiplier || 0))
  }),
}

export const runeEffects = {
  // 残忍
  'cruel': (stats, effectData, runeFactor, typeFactor) => {
    stats.cruelRune += (effectData?.extraValue || 0) * (runeFactor?.extraValue || 1.0) * typeFactor;
    stats.cruelRatioRune += (effectData?.extraMultiplier || 0) * (runeFactor?.extraMultiplier || 1.0) * typeFactor;
  }
}

export const monsterEffects = {
  '求生': (stats, monsterHpSegment, monsterInfo) => {
    monsterHpSegment.push({
      hpPercent: 10,
      hpPercentType: 'below',
      monsterEvasion: 60
    });
  },
  '冰霜巫术': (stats, monsterHpSegment, monsterInfo) => {
    monsterHpSegment.push({
      hpPercent: 50,
      hpPercentType: 'below',
      monsterLeech: monsterInfo.hpMax * 0.02
    });
  },
  '冰霜护盾': (stats, monsterHpSegment, monsterInfo) => {
    monsterHpSegment.push({
      hpPercent: 50,
      hpPercentType: 'below',
      monsterEvasion: 55
    });
  },
  '惊骇': (stats, monsterHpSegment, monsterInfo) => {
    monsterHpSegment.push({
      hpPercent: 10,
      hpPercentType: 'below',
      specialFunc: (stats) => { stats.hr -= 50 }
    });
  },
  '吸血': (stats, monsterHpSegment, monsterInfo) => { 
    if (monsterInfo.name.includes('吸血鬼王')) {
      stats.monsterLeech = monsterInfo.hpMax * 0.02;
    } else if (monsterInfo.name.includes('吸血鬼')) {
      stats.monsterLeech = monsterInfo.hpMax * 0.01;
    } else {
      stats.monsterLeech = monsterInfo.hpMax * 0.02;
    }
  },
  // TODO: 多段攻击免疫效果优化
  '反击': (stats, monsterHpSegment, monsterInfo) => { stats.split *= 0.7 },
  '恐吓': (stats, monsterHpSegment, monsterInfo) => { stats.heat *= 0.5 },
  '磐石': (stats, monsterHpSegment, monsterInfo) => {
    if (monsterInfo.name.includes('金人')) {
      stats.monsterDefense = 50
    } else {
      stats.monsterDefense = 15
    }
  },
  '坚韧': (stats, monsterHpSegment, monsterInfo) => {
    monsterHpSegment.push({
      hpPercent: 20,
      hpPercentType: 'below',
      monsterDefense: 200
    });
  },
  '虚弱': (stats, monsterHpSegment, monsterInfo) => { stats.atk *= 0.5 },
  '麻痹': (stats, monsterHpSegment, monsterInfo) => { stats.paralysis = 60 },
  '迟缓': (stats, monsterHpSegment, monsterInfo) => { stats.finalAtksp -= 0.3 },
}