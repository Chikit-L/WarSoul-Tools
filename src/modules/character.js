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

        const attrPanel = document.querySelector(".user-attrs");
        let dpsEle = document.getElementById("wst-dps");
        if (!dpsEle) {
            dpsEle = document.createElement("div");
            dpsEle.id = "wst-dps";
            dpsEle.style.fontSize = "14px";
            attrPanel.insertBefore(dpsEle, attrPanel.firstElementChild?.nextElementSibling || attrPanel.firstElementChild);
        }
        dpsEle.innerText = `裸DPS估算: ${parsed.stats.dpsRaw.toFixed(0)}`;
    }, 1000);
    return obj;
});

// See user info
registMessageHandler(/^4324\[/, (obj) => {
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
        break: 0,           // 破阵：攻击力追加
        sharp: 0,           // 锋利：攻击时附加伤害
        tearInjury: 0,      // 裂创：暴击时额外真实伤害
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
        const typeFactor = characterInfo.soulType == rune.origin.soulType ? 1.2 : 1.0;
        Object.entries(rune.attrs.basic).forEach(([attr, val]) => {
            // 系数
            const p = runeData.runeBasicFactor[attr] || 1.0;
            stats[attr] += val * p * typeFactor;
        });
        // 符石特殊属性
        for (let effect of (rune.attrs?.special || [])) {
            const key = `${effect.key}Rune`
            const p = runeData.runeSpecialFactor[effect.key] || {};
            if (stats[key] !== undefined) {
                // TODO: 更多词条支持
                if (effect.data.extraRate) {
                    stats[key] += effect.data.extraRate * (p?.extraRate || 1.0) * typeFactor;
                } else if (effect.data.extraValue) {
                    stats[key] += effect.data.extraValue * (p?.extraValue || 1.0) * typeFactor;
                }
            }
        }
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
        for (let effect of (weapon.origin?.attrs?.special || [])) {
            if (stats[effect.key] !== undefined) {
                const runeKey = `${effect.key}Rune`
                // TODO: 更多词条支持
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
    });

    // 最终攻击力计算
    stats.finalAtk = stats.atk * (1 + stats.break / 100)
    // 最终攻速计算
    stats.finalAtksp = (stats.atksp / 100 - 1) * (1 + stats.swiftness) + 1;
    // 拟合公式
    stats.actualAtksp = (38.097 * stats.finalAtksp ** 2 + 123.3 * stats.finalAtksp + 32.018) / 180;

    stats.dpsRaw = stats.actualAtksp * Math.min(stats.hr / 100, 1) * (
        stats.atk * Math.max(1 - stats.crt / 100, 0)+
        stats.crtd / 100 * stats.atk * Math.min(stats.crt / 100, 1) +
        stats.split * stats.chasing +
        stats.split * stats.heavyInjury * Math.min(stats.crt / 100, 1) +
        stats.split * stats.thump +
        stats.split * stats.tearInjury
    ) * (1 + stats.sharp / 100) * (1 + stats.ad / 100)

    return {
        weaponList,
        fightPet,
        runeList,
        stats
    };
}