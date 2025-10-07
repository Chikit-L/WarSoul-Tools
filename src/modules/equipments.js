import { registHTTPRequestHandler, registMessageHandler, registSendHookHandler, requestIdCounter, wsSend } from "./connection";
import { effects, runeEffects, segmentEffects } from "./effects";
import { loadFromLocalStorage, saveToLocalStorage, logMessage } from "./utils";

export const equipmentsData = loadFromLocalStorage("equipmentsData", {});

registHTTPRequestHandler(/awakening-of-war-soul-ol\/socket\.io/, /.*/, /^430.+/, (res) => {
  Object.assign(equipmentsData, res[0].data);
  logMessage(`Equipments Data Updated, total ${Object.keys(equipmentsData).length} items`);
  saveToLocalStorage("equipmentsData", equipmentsData);
  return res;
});

export const runeData = loadFromLocalStorage("runeData", {});

registMessageHandler(/^431\[/, (obj) => {
  Object.assign(runeData, obj[0].data);
  logMessage(`Rune Data Updated, total ${Object.keys(runeData.runeCollection).length} runes`);
  saveToLocalStorage("runeData", runeData);
  return obj;
});

export const relicData = loadFromLocalStorage("relicData", {});

registMessageHandler(/^432\[/, (obj) => {
  Object.assign(relicData, obj[0].data);
  logMessage(`Relic Data Updated, total ${Object.keys(relicData).length} relics`);
  saveToLocalStorage("relicData", relicData);
  return obj;
});

export const darkGoldData = loadFromLocalStorage("darkGoldData", {});

registMessageHandler(/^433\[/, (obj) => {
  Object.assign(darkGoldData, obj[0].data);
  logMessage(`Dark Gold Data Updated`);
  saveToLocalStorage("darkGoldData", darkGoldData);
  return obj;
});


export const starAttrMap = {
  1: (stat) => { stat.atk += 2 },      // 攻击 + 2
  2: (stat) => { stat.atksp += 1 },    // 攻击速度 + 1%
  3: (stat) => { stat.crt += 2 },      // 暴击率 + 2%
  4: (stat) => { stat.crtd += 6 },     // 暴击伤害 + 6%
  5: (stat) => { stat.heat += 3 },     // 破防 + 3
  6: (stat) => { stat.hr += 1 },       // 命中率 + 1%
}

export const equipmentEnhanceMap = {
  'weapon': (stat, level) => { stat.atk += equipmentEnhanceTable.atk[level] || 0 },
  'helmet': (stat, level) => { stat.heat += equipmentEnhanceTable.heat[level] || 0 },
  'armor': (stat, level) => { stat.hr += equipmentEnhanceTable.rate[level] || 0 },
  'shoes': (stat, level) => { stat.atksp += equipmentEnhanceTable.rate[level] || 0 },
  'jewelry': (stat, level) => {
    stat.crt += equipmentEnhanceTable.rate[level] || 0
    stat.crtd += equipmentEnhanceTable.crtd[level] || 0
  },
}

export function weaponSpecialParse(stats, effect, type = "normal") {
  const effectData = JSON.parse(JSON.stringify(effect.data));

  if (type === "darkGold") {
    const darkGoldEffectData = darkGoldData.darkGoldSpecialFactor[effect.key];
    Object.keys(darkGoldEffectData).forEach(factorKey => {
      if (effectData[factorKey] !== undefined) {
        effectData[factorKey] = (effectData[factorKey] + 10) * darkGoldEffectData[factorKey];
      }
    });
  }

  if (stats[effect.key] !== undefined) {
    const runeKey = `${effect.key}Rune`
    if (Object.keys(effects).includes(effect.key)) {
      effects[effect.key](stats, effectData);
    } else if (runeKey in stats) {
      stats[effect.key] += effectData.value + stats[runeKey];
    } else if (effectData.value) {
      stats[effect.key] += effectData.value;
    } else if (effectData.multiplier) {
      stats[effect.key] += effectData.multiplier;
    }
  } else if (Object.keys(segmentEffects).includes(effect.key)) {
    addStatsSegment(stats, effect.key, effectData);
  } else if (!stats.ignoreSpecials.includes(effect.key)) {
    stats.ignoreSpecials.push(effect.key);
  }
}

export function runeSpecialParse(stats, effect, typeFactor=1.0) {
  const key = `${effect.key}Rune`
  const p = runeData.runeSpecialFactor[effect.key] || {};
  if (Object.keys(runeEffects).includes(effect.key)) {
    runeEffects[effect.key](stats, effect.data, p, typeFactor);
  } else if (p.extraHpPercent) {
    addRuneSegment(stats, effect.key, p, typeFactor);
  } else if (stats[key] !== undefined) {
    if (effect.data.extraRate) {
      stats[key] += effect.data.extraRate * (p?.extraRate || 1.0) * typeFactor;
    } else if (effect.data.extraValue) {
      stats[key] += effect.data.extraValue * (p?.extraValue || 1.0) * typeFactor;
    } else if (effect.data.extraMultiplier) {
      stats[key] += effect.data.extraMultiplier * (p?.extraMultiplier || 1.0) * typeFactor;
    }
  } else if (!stats.ignoreSpecials.includes(key)) {
    stats.ignoreSpecials.push(key);
  }
}

export function addStatsSegment(stats, type, effect) {
  stats.segments.push({
    type,
    ...effect
  });
}

function addRuneSegment(stats, name, effect, typeFactor) {
  stats.segments.forEach(segment => {
    if (segment.type === name) {
      Object.keys(effect).forEach(key => {
        if (key === 'extraHpPercent') {
          segment.extraHpPercent = (segment.extraHpPercent || 0) + effect[key] * typeFactor;
        } else {
          segment[key] = (segment[key] || 0) + effect[key] * typeFactor;
        }
      });
    }
  });
}

export function parsePlayerSegments(stats) {
  const hpSegments = [
    {
      hpPercent: 0,
      hpPercentType: 'above',
      ...stats
    }
  ]; // 以血量百分比为key，属性对象为value
  stats.segments.forEach(segment => {
    const actualHpPercent = 100 - (1 + (segment.extraHpPercent || 0)) * (100 - segment.hpPercent);
    if (Object.keys(segmentEffects).includes(segment.type)) {
      hpSegments.push({
        hpPercent: actualHpPercent,
        ...segmentEffects[segment.type](segment)
      });
    } else {
      stats.ignoreSpecials.push(segment.type);
    }
  });
  return hpSegments;
}

export function segmentsParse(stats, monsterSegments=[]) {
  const hpSegments = parsePlayerSegments(stats);
  hpSegments.push(...monsterSegments);
  return mergeHpSegments(hpSegments);
}

export const atkSpMap = {
  1.001: 195,
  1.112: 219,
  1.251: 251,
  1.430: 292,
  1.700: 350,
  2.003: 437,
  2.504: 582,
  3.340: 872,
}

export function mergeHpSegments(hpSegments) {
  const breakpoints = new Set([0]);
  hpSegments.forEach(seg => {
    breakpoints.add(seg.hpPercent);
  });

  // 按血量从低到高排序断点
  const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);

  // 为每个断点计算生效的属性
  const merged = {};
  sortedBreakpoints.forEach(bp => {
    merged[bp] = {
      hpPercent: bp,
      hpPercentType: 'above'
    };

    // 遍历所有分段，判断在当前血量断点下哪些分段生效
    hpSegments.forEach(seg => {
      let shouldInclude = false;

      if (seg.hpPercentType === 'below') {
        // below X 表示血量 < X 时生效，转换为 above 视角：
        // 只在血量断点 < X 时该分段才生效
        shouldInclude = bp < seg.hpPercent;
      } else {
        // above X 表示血量 >= X 时生效
        shouldInclude = bp >= seg.hpPercent;
      }

      if (shouldInclude) {
        // 合并属性，排除元数据字段
        Object.keys(seg).forEach(k => {
          if (k !== 'hpPercent' && k !== 'hpPercentType' &&
            k !== 'segments' && k !== 'ignoreSpecials' &&
            k !== 'type' && k !== 'extraHpPercent') {
            if (typeof seg[k] === 'number') {
              merged[bp][k] = (merged[bp][k] || 0) + seg[k];
            } else if (k === 'specialFunc') {
              merged[bp].specialFunc = (merged[bp].specialFunc || []).concat([seg[k]]);
            } else if (merged[bp][k] === undefined) {
              merged[bp][k] = seg[k];
            }
          }
        });
      }
    });
  });

  return Object.values(merged).sort((a, b) => b.hpPercent - a.hpPercent);
}

export function sellEquipment(equipmentId) {
  wsSend(`42${requestIdCounter}["sellEquip",{"idList":["${equipmentId}"]}]`)
};

export function equipEquipment(equipmentId) {
  wsSend(`42${requestIdCounter}["equipAcion",{"id":"${equipmentId}","action":"wear"}]`)
};

export function equipRune(runeId, slot) {
  wsSend(`42${requestIdCounter}["runeAction",{"id":"${runeId}","action":"wear","index":${slot}}]`)
};

export function unequipRune(runeId) {
  wsSend(`42${requestIdCounter}["runeAction",{"id":"${runeId}","action":"remove"}]`)
};

export function equipPet(petId) {
  wsSend(`42${requestIdCounter}["setPetFight",{"id":"${petId}"}]`)
}

const equipmentEnhanceTable = { atk: { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10, 7: 12, 8: 14, 9: 17, 10: 21, 11: 24, 12: 27, 13: 30, 14: 33, 15: 36, 16: 36, 17: 36, 18: 36 }, heat: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 7, 7: 9, 8: 11, 9: 13, 10: 16, 11: 18, 12: 20, 13: 22, 14: 24, 15: 26, 16: 26, 17: 26, 18: 26 }, rate: { 1: .4, 2: .8, 3: 1.2, 4: 1.8, 5: 2.4, 6: 3.2, 7: 4, 8: 4.5, 9: 5, 10: 6, 11: 6.5, 12: 7, 13: 7.5, 14: 8, 15: 8.5, 16: 8.5, 17: 8.5, 18: 8.5 }, crtd: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5.5, 6: 7, 7: 8.5, 8: 10, 9: 12, 10: 13.5, 11: 15, 12: 16.5, 13: 18, 14: 19.5, 15: 21, 16: 21, 17: 21, 18: 21 } }
