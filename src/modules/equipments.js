import { registHTTPRequestHandler, registMessageHandler } from "./connection";
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

export const starAttrMap = {
  1: (stat)=>{stat.atk += 2},      // 攻击 + 2
  2: (stat)=>{stat.atksp += 1},    // 攻击速度 + 1%
  3: (stat)=>{stat.crt += 2},      // 暴击率 + 2%
  4: (stat)=>{stat.crtd += 6},     // 暴击伤害 + 6%
  5: (stat)=>{stat.heat += 3},     // 破防 + 3
  6: (stat)=>{stat.hr += 1},       // 命中率 + 1%
}

export const equipmentEnhanceMap = {
  'weapon': (stat, level) => {stat.atk += level * 2.4}, 
  'helmet': (stat, level) => {stat.heat += level * 1.6},
  'armor': (stat, level) => {stat.hr += level * 0.6},
  'shoes': (stat, level) => {stat.atksp += level * 0.6},
  'jewelry': (stat, level) => {
    stat.crt += level * 0.56
    stat.crtd += level * 1.4
  },
}