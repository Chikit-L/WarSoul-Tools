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
  '求生': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: abilityInfo[1],
      hpPercentType: 'below',
      monsterEvasion: abilityInfo[2]
    });
  },
  '冰霜巫术': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: 50,
      hpPercentType: 'below',
      monsterLeech: monsterInfo.hpMax * 0.02
    });
  },
  '冰霜护盾': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: 50,
      hpPercentType: 'below',
      monsterEvasion: 55
    });
  },
  '惊骇': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: 10,
      hpPercentType: 'below',
      specialFunc: (stats) => { stats.hr -= 50 }
    });
  },
  '吸血': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { 
    stats.monsterLeech = monsterInfo.hpMax * abilityInfo[2] / 100;
  },
  // TODO: 多段攻击免疫效果优化
  '反击': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.split *= 0.7 },
  '恐吓': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.heat *= 0.5 },
  '磐石': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    stats.monsterDefense = abilityInfo[1] / 100 * abilityInfo[2]
  },
  '坚韧': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: abilityInfo[1] || 20,
      hpPercentType: 'below',
      monsterDefense: abilityInfo[2] || 200
    });
  },
  '无畏': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: abilityInfo[1] || 70,
      hpPercentType: 'below',
      monsterDefense: abilityInfo[2] || 100
    });
  },
  '虚弱': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.atk *= 0.5 },
  '麻痹': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.paralysis = abilityInfo[1] },
  '迟缓': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.finalAtksp -= abilityInfo[1] / 100 },
  '诅咒': (stats, monsterHpSegment, monsterInfo, abilityInfo) => { stats.hr -= abilityInfo[1] / 100 },
  '修复': (stats, monsterHpSegment, monsterInfo, abilityInfo) => {
    monsterHpSegment.push({
      hpPercent: abilityInfo[1],
      hpPercentType: 'above',
      healPercent: abilityInfo[2],
      healTimes: 1
    });
    monsterHpSegment.push({ // 无实际作用，用于显示回血分段
      hpPercent: abilityInfo[1] + abilityInfo[2],
      hpPercentType: 'above',
    });
  },
}