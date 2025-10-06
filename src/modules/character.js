import { logMessage, parseWSmessage } from "./utils.js";
import { registMessageHandler, registOneTimeResponseHandler, registSendHookHandler, requestIdCounter, wsSend } from "./connection.js";
import { atkSpMap, darkGoldData, equipmentEnhanceMap, equipmentsData, relicData, runeData, runeSpecialParse, starAttrMap, weaponSpecialParse } from "./equipments.js";

export const characterInfo = {};

// Update character info
registMessageHandler(/^434\[/, (obj) => {
  if (!obj[0].data.itemList) {
    return obj;
  }
  Object.assign(characterInfo, obj[0].data);
  characterInfo.isAdvance = characterInfo.advanceLevel == 4;
  logMessage(`Character Info Updated ${characterInfo.id}`);
  setTimeout(() => {
    const parsed = parseCharacterEquipment(characterInfo);
    characterInfo.parsed = parsed;
    logMessage(`Character Equipment Parsed:`);
    logMessage(parsed);
    updateCharacterInfoPanelDps();
  }, 1000);
  return obj;
});

// registSendHookHandler(/\["seeUserInfo",/, (message) => {
//     const startNumber = parseInt(message.match(/^\d+/)?.[0]);
//     return {
//         responseRegex: new RegExp(`^${startNumber + 100}`),
//         handler: (obj, other) => {
//             const playerData = obj[0].data;
//             playerData.parsed = parseCharacterEquipment(playerData);
//             logMessage(`Other Character Info Updated:`);
//             logMessage(playerData.parsed);
//         }
//     }
// });

export function getUserInfo(userId) {
  const requestId = `42${requestIdCounter}`;
  wsSend(`${requestId}["seeUserInfo",{"userId":${userId}}]`);
  registOneTimeResponseHandler(
    new RegExp(`^${parseInt(requestId) + 100}\\[`),
    (obj, other) => {
      return obj[0].data;
    }
  ).then((obj, other) => {
    const playerData = obj;
    logMessage(playerData);
  });
}

export function refreshCharacterInfo() {
  wsSend(`42${requestIdCounter}["init",{}]`);
}

function parseCharacterEquipment(character) {
  let weaponList = (character.equippedList || {});
  let fightPet = (character.petList || []).find(pet => pet.id == character.fightPetId);
  let runeList = (character.runeEquippedList || []).filter(item => item !== "");
  let relicList = (character.relicEquippedList || []).filter(item => item !== "");
  if (character.itemList) {
    // 玩家
    Object.entries(weaponList).forEach(([key, value]) => {
      const item = character.itemList.find(item => item.id === value || item.id === value?.id);
      item.origin = equipmentsData[item.equipId];
      weaponList[key] = item;
    });
    runeList = runeList.map(rune => {
      rune = character.runeList.find(item => item.id === rune);
      rune.origin = runeData.runeCollection[rune.runeId];
      return rune;
    });
    relicList = relicList.map(relic => {
      relic = character.relicList.find(item => item.id === relic);
      relic.origin = relicData[relic.relicId];
      return relic;
    });
  } else {
    // 其他人
    weaponList = {};
    for (let weapon of character.equipList) {
      const origin = equipmentsData[weapon.equipId];
      weaponList[origin.type] = {
        origin: origin,
        ...weapon
      };
    }
    runeList = character.runeList.filter(item => item && item !== "").map(rune => {
      rune.origin = runeData.runeCollection[rune.runeId];
      return rune;
    });
    relicList = character.relicList.filter(item => item && item !== "").map(relic => {
      relic.origin = relicData[relic.relicId];
      return relic;
    });
  }

  const stats = {
    atk: 100,           // 攻击
    atksp: 100,         // 攻击速度
    crt: 0,             // 暴击率
    crtd: 150,          // 暴击伤害
    heat: 0,            // 破防
    hr: 100,            // 命中率
    voidDef: 0,         // 抗魔
    ad: 0,              // 全伤害加成

    waterDa: 0,
    fireDa: 0,
    windDa: 0,
    soilDa: 0,

    swiftness: 0,       // 轻灵：攻速乘子
    swiftnessRune: 0,
    split: 1,           // 分裂攻击次数期望
    splitRune: 0,
    chasing: 0,         // 追击：攻击追加
    chasingRune: 0,
    heavyInjury: 0,     // 重创：暴击追加
    heavyInjuryRune: 0,
    thump: 0,           // 重击期望：概率额外伤害
    break: 0,           // 破阵：攻击力追加
    sharp: 0,           // 锋利：攻击时附加伤害
    tearInjury: 0,      // 裂创：暴击时额外真实伤害
    shadowBlade: 0,     // 影刃：攻击时附加真实伤害
    
    cruel: 0,           // 残暴：暴击破防
    cruelRune: 0,
    cruelRatio: 0,      // 残暴：暴击破防乘子
    cruelRatioRune: 0,

    ignoreSpecials: [],
  };

  // 装备基础属性
  Object.entries(weaponList).forEach(([weaponType, weapon]) => {
    for (let starType of (weapon.starAttrs || [])) {
      starAttrMap[starType](stats);
    }
    // 升级属性加成
    equipmentEnhanceMap[weaponType](stats, Math.min(weapon.reinforcedLevel, 15));
    // +15后全伤害加成
    stats.ad += Math.max(weapon.reinforcedLevel - 15, 0) * 0.2;
    // 基础装备属性
    Object.entries(weapon.origin.attrs.basic).forEach(([attr, val]) => {
      stats[attr] += val;
    });
    // 附魔属性
    if (weapon.enchantAttr) {
      stats.voidDef += weapon.enchantAttr[0] * 10;
      stats.ad += weapon.enchantAttr[1];
    }
    // 暗金属性
    for (let effect of (weapon?.darkGoldAttrs?.basic || [])) {
      stats[effect[0]] += (effect[1] + 5) * darkGoldData.darkGoldBasicFactor[effect[0]];
    }

    // 精造属性
    stats.ad += 0.4 * (weapon.refineAttr?.[0] || 0);
  });

  // 符石
  for (let rune of runeList) {
    // 符石基础属性
    const typeFactor = character.soulType == rune.origin.soulType ? 1.2 : 1.0;
    Object.entries(rune.attrs.basic).forEach(([attr, val]) => {
      // 系数
      const p = runeData.runeBasicFactor[attr] || 1.0;
      stats[attr] += val * p * typeFactor;
    });
    // 符石特殊属性
    for (let effect of (rune.attrs?.special || [])) {
      runeSpecialParse(stats, effect, typeFactor);
    }
  }

  // 圣物
  for (let relic of relicList) {
    // 圣物基础属性
    Object.entries(relic.origin.attrs.basic).forEach(([attr, val]) => {
      stats[attr] += val + ((relic.origin.grow?.basic[attr] || 0) * relic.count);
    });
  }

  // 宠物基础属性
  Object.entries(fightPet?.fightAttrs || {}).forEach(([attr, val]) => {
    // 系数
    // const p = runeData.runeBasicFactor[attr] || 1.0;
    const p = 1.0;
    stats[attr] += val * p;
  });

  // 武器特效
  Object.entries(weaponList).forEach(([weaponType, weapon]) => {
    // 普通特效
    for (let effect of (weapon.origin?.attrs?.special || [])) {
      weaponSpecialParse(stats, effect);
    }
    // 暗金特效 TODO: bugfix
    for (let effect of (weapon.darkGoldAttrs?.special || [])) {
      weaponSpecialParse(stats, effect, "darkGold");
    }
    // 刻印特效
    for (let effect of (weapon.engrave?.special || [])) {
      weaponSpecialParse(stats, effect, "darkGold");
    }
  });

  // 临时buff
  for (let buff of (characterInfo.temporaryBuff || [])) {
    Object.entries(buff.basic || {}).forEach(([attr, val]) => {
      stats[attr] += val;
    });
  }

  // 最终攻击力计算
  stats.finalAtk = stats.atk * (1 + stats.break / 100)
  // 最终攻速计算
  stats.finalAtksp = (stats.atksp / 100 - 1) * (1 + stats.swiftness) + 1;
  // 拟合公式
  if (characterInfo.isAdvance) {
    stats.actualAtksp = stats.finalAtksp;
  } else {
    Object.entries(atkSpMap).forEach(([atkSp, actAtkSp]) => {
      if (stats.finalAtksp >= parseFloat(atkSp)) {
        stats.actualAtksp = actAtkSp / 180;
      }
    });
  }

  stats.dpsRaw = getDps(stats);

  return {
    weaponList,
    fightPet,
    runeList,
    relicList,
    stats,
  };
}

export function getDps(stats, defense = 0, evasion = 0, antiCrit = 0) {
  const crt = Math.max(Math.min(stats.crt - antiCrit, 100) / 100, 0);
  const defenseFactor = (
    // 非暴击
    150 / (150 + Math.max(defense - stats.heat, 0)) * (1 - crt) +
    // 暴击
    150 / (150 + Math.max(defense * Math.max(1 - stats.cruelRatio / 100, 0) - stats.heat - stats.cruel, 0)) * crt
  )

  return stats.actualAtksp * Math.max(Math.min((stats.hr - evasion) / 100, 1), 0) * (
    // 需要整合防御计算部分
    defenseFactor * (
      stats.atk * (1 - crt) +
      stats.crtd / 100 * stats.atk * crt +
      stats.split * stats.chasing +
      stats.split * stats.heavyInjury * crt +
      stats.split * stats.thump +
      stats.split * stats.tearInjury
    ) + 
    // 真实伤害部分
    (
      stats.split * stats.shadowBlade
    )
  ) * (1 + stats.sharp / 100) * (1 + stats.ad / 100)
}

function updateCharacterInfoPanelDps() {
  const attrPanel = document.querySelector(".user-attrs");
  let dpsEle = document.getElementById("wst-dps");
  if (!dpsEle) {
    dpsEle = document.createElement("div");
    dpsEle.id = "wst-dps";
    dpsEle.style.fontSize = "14px";
    attrPanel.insertBefore(dpsEle, attrPanel.firstElementChild?.nextElementSibling || attrPanel.firstElementChild);
  }
  dpsEle.innerText = `裸DPS估算: ${characterInfo.parsed.stats.dpsRaw.toFixed(0)}`;
}

registSendHookHandler(/\["useEquipRoutine",/, (message) => {
  const obj = parseWSmessage(message);
  const routineId = obj[1].id;
  const routine = characterInfo.equippedRoutineList.find(r => r.id === routineId);
  if (!routine) {
    logMessage(`Cannot find routine ${routineId} in characterInfo`);
    return;
  }

  characterInfo.equippedList = routine.equippedList;
  characterInfo.runeEquippedList = routine?.runeEquippedList || [];
  characterInfo.relicEquippedList = routine?.relicEquippedList || [];

  characterInfo.parsed = parseCharacterEquipment(characterInfo);
  updateCharacterInfoPanelDps();

  return;
});

registSendHookHandler(/\["equipAcion",/, (message) => {
  const obj = parseWSmessage(message);
  const weaponId = obj[1].id;
  const action = obj[1].action;
  const nowRoutine = characterInfo.equippedRoutineList.find(r => r.id === characterInfo.equippedRoutineId);

  if (action == "wear") {
    const weapon = characterInfo.itemList.find(item => item.id === weaponId);
    const weaponType = equipmentsData[weapon.equipId].type;
    characterInfo.equippedList[weaponType] = weaponId;
    if (nowRoutine) {
      nowRoutine.equippedList[weaponType] = weaponId;
    }
  }

  characterInfo.parsed = parseCharacterEquipment(characterInfo);
  updateCharacterInfoPanelDps();

  return;
});

registSendHookHandler(/\["runeAction",/, (message) => {
  const obj = parseWSmessage(message);
  const runeId = obj[1].id;
  const action = obj[1].action;
  const index = obj[1].index;
  const nowRoutine = characterInfo.equippedRoutineList.find(r => r.id === characterInfo.equippedRoutineId);

  if (action == "wear") {
    while (index >= characterInfo.runeEquippedList.length) {
      characterInfo.runeEquippedList.push('');
    }
    characterInfo.runeEquippedList[index] = runeId;

    if (nowRoutine) {
      while (index >= nowRoutine.runeEquippedList.length) {
        nowRoutine.runeEquippedList.push('');
      }
      nowRoutine.runeEquippedList[index] = runeId;
    }
  }

  characterInfo.parsed = parseCharacterEquipment(characterInfo);
  updateCharacterInfoPanelDps();

  return;
});