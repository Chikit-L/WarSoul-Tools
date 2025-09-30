import { registHTTPRequestHandler, registMessageHandler, registSendHookHandler, requestIdCounter, wsSend } from "./connection";
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
  1:(stat)=>{stat.atk += 2},      // 攻击 + 2
  2:(stat)=>{stat.atksp += 1},    // 攻击速度 + 1%
  3:(stat)=>{stat.crt += 2},      // 暴击率 + 2%
  4:(stat)=>{stat.crtd += 6},     // 暴击伤害 + 6%
  5:(stat)=>{stat.heat += 3},     // 破防 + 3
  6:(stat)=>{stat.hr += 1},       // 命中率 + 1%
}

export const equipmentEnhanceMap = {
  'weapon':(stat, level) => {stat.atk += equipmentEnhanceTable.atk[level] || 0}, 
  'helmet':(stat, level) => {stat.heat += equipmentEnhanceTable.heat[level] || 0},
  'armor':(stat, level) => {stat.hr += equipmentEnhanceTable.rate[level] || 0},
  'shoes':(stat, level) => {stat.atksp += equipmentEnhanceTable.rate[level] || 0},
  'jewelry':(stat, level) => {
    stat.crt += equipmentEnhanceTable.rate[level] || 0
    stat.crtd += equipmentEnhanceTable.crtd[level] || 0
  },
}

export function weaponSpecialParse(stats, effect) {
  if (stats[effect.key] !== undefined) {
      const runeKey = `${effect.key}Rune`
      // TODO:更多词条支持
      if (effect.key === 'split') {
          const splitRate = effect.data.rate * (1 + stats.splitRune) / 100;
          stats.split = stats.split + splitRate * effect.data.value;
      } else if (effect.key === 'thump') {
          stats.thump = stats.thump + effect.data.rate / 100 * effect.data.value
      } else if (effect.key === 'swiftness') {
          stats.swiftness += (effect.data.value - 1) + stats.swiftnessRune
      } else if (runeKey in stats) {
          stats[effect.key] += effect.data.value + stats[runeKey];
      } else if (effect.data.value) {
          stats[effect.key] += effect.data.value;
      } else if (effect.data.multiplier) {
          stats[effect.key] += effect.data.multiplier;
      }
  }
}

export const atkSpMap = {
  1.001:195,
  1.112:219,
  1.251:251,
  1.430:292,
  1.700:350,
  2.003:437,
  2.504:582,
  3.340:872,
}

const equipmentEnhanceTable = {atk:{1:2,2:3,3:4,4:6,5:8,6:10,7:12,8:14,9:17,10:21,11:24,12:27,13:30,14:33,15:36,16:36,17:36,18:36},heat:{1:1,2:2,3:3,4:4,5:6,6:7,7:9,8:11,9:13,10:16,11:18,12:20,13:22,14:24,15:26,16:26,17:26,18:26},rate:{1:.4,2:.8,3:1.2,4:1.8,5:2.4,6:3.2,7:4,8:4.5,9:5,10:6,11:6.5,12:7,13:7.5,14:8,15:8.5,16:8.5,17:8.5,18:8.5},crtd:{1:1,2:2,3:3,4:4,5:5.5,6:7,7:8.5,8:10,9:12,10:13.5,11:15,12:16.5,13:18,14:19.5,15:21,16:21,17:21,18:21}}

export function sellEquipment(equipmentId) {
    wsSend(`42${requestIdCounter}["sellEquip",{"idList":["${equipmentId}"]}]`)
};

export function equipEquipment(equipmentId) {
    wsSend(`42${requestIdCounter}["equipAcion",{"id":"${equipmentId}","action":"wear"}]`)
};

export function equipRune(runeId,slot) {
    wsSend(`42${requestIdCounter}["runeAction",{"id":"${runeId}","action":"wear","index":${slot}}]`)
};

export function unequipRune(runeId) {
    wsSend(`42${requestIdCounter}["runeAction",{"id":"${runeId}","action":"remove"}]`)
};

export function equipPet(petId) {
    wsSend(`42${requestIdCounter}["setPetFight",{"id":"${petId}"}]`)
}
