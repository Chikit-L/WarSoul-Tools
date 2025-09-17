import { logMessage } from "./utils.js";
import { registMessageHandler, wsSend } from "./connection.js";
import { equipmentEnhanceMap, equipmentsData, runeData, starAttrMap } from "./equipments.js";

export const characterInfo = {};

// Update character info
registMessageHandler(/^434\[/, (obj) => {
    if (!obj[0].data.itemList) {
        return obj;
    }
    Object.assign(characterInfo, obj[0].data);
    logMessage(`Character Info Updated ${characterInfo.id}`);
    setTimeout(() => {
        const parsed = parseCharacterEquipment();
        characterInfo.parsed = parsed;
        logMessage(`Character Equipment Parsed:`);
        logMessage(parsed);
    }, 1000);
    return obj;
});

// See user info
registMessageHandler(/^4324/, (obj) => {
    logMessage(`Other Character Info Updated:`);
    logMessage(obj);
    return obj;
});

export function getUserInfo(userId) {
    wsSend(`4224["seeUserInfo",{"userId":${userId}}]`);
}

function parseCharacterEquipment() {
    const weaponList = (characterInfo.equippedList || {});
    Object.entries(weaponList).forEach(([key, value]) => {
        const item = characterInfo.itemList.find(item => item.id === value);
        item.origin = equipmentsData[item.equipId];
        weaponList[key] = item;
    });

    const fightPet = (characterInfo.petList || []).find(pet => pet.id == characterInfo.fightPetId);

    const runeList = (characterInfo.runeEquippedList || []).map(rune => {
        rune = characterInfo.runeList.find(item => item.id === rune);
        rune.origin = runeData.runeCollection[rune.runeId];
        return rune;
    });

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
    };

    // 装备基础属性
    Object.entries(weaponList).forEach(([weaponType, weapon]) => {
        for (let starType of (weapon.starAttrs || [])) {
            starAttrMap[starType](stats);
        }
        // 升级属性加成
        equipmentEnhanceMap[weaponType](stats, Math.min(weapon.reinforcedLevel, 15));
        // +15后全伤害加成
        stats.ad += Math.max(weapon.reinforcedLevel-15, 0) * 0.2;
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
        Object.entries(weapon?.darkGoldAttrs?.basic || {}).forEach(([attr, val]) => {
            stats[attr] += val;
        });
    });

    // 符石
    for (let rune of runeList) {
        // 符石基础属性
        Object.entries(rune.attrs.basic).forEach(([attr, val]) => {
            stats[attr] += val;
        });
        // 符石特殊属性
        for (let effect of (rune.attrs?.special || [])) {
            const key = `${effect.key}Rune`
            if (stats[key] !== undefined) {
                if (effect.data.extraRate) {
                    stats[key] += effect.data.extraRate;
                } else {
                    stats[key] += effect.data.extraValue;
                }
            }
        }
    }

    // 宠物基础属性
    Object.entries(fightPet?.fightAttrs || {}).forEach(([attr, val]) => {
        stats[attr] += val;
    });

    // 武器特效
    Object.entries(weaponList).forEach(([weaponType, weapon]) => {
        for (let effect of (weapon.origin?.attrs?.special || [])) {
            if (stats[effect.key] !== undefined) {
                const runeKey = `${effect.key}Rune`
                if (effect.key === 'split') {
                    stats.split = stats.split * ((effect.data.rate + stats.splitRune) / 100 * (effect.data.value - 1) + 1)
                } else if (effect.key === 'thump') {
                    stats.thump = stats.thump + effect.data.rate / 100 * effect.data.value
                } else if (effect.key === 'swiftness') {
                    stats.swiftness = (stats.swiftness - 1) + stats.swiftnessRune
                } else if (runeKey in stats) {
                    stats[effect.key] += effect.data.value + stats[runeKey];
                } else {
                    stats[effect.key] += effect.data.value;
                }
            }
        }
    });

    // 最终攻速计算
    stats.atksp = stats.atksp * (1 + stats.swiftness);

    return {
        weaponList,
        fightPet,
        runeList,
        stats
    };
}