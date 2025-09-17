import { logMessage } from "./utils.js";
import { registMessageHandler, wsSend } from "./connection.js";
import { equipmentEnhanceMap, equipmentsData, runeData, starAttrMap } from "./equipments.js";

export const characterInfo = {};

// Update character info
registMessageHandler(/^434/, (obj) => {
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
    logMessage(`Character Info Updated:`);
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
        atk: 100,
        atksp: 100,
        crt: 0,
        crtd: 150,
        heat: 0,
        hr: 100
    };

    Object.entries(weaponList).forEach(([key, value]) => {
        for (let starType of (value.starAttrs || [])) {
            starAttrMap[starType](stats);
        }
        equipmentEnhanceMap[key](stats, value.reinforcedLevel)

        Object.entries(value.origin.attrs.basic).forEach(([attr, val]) => {
            stats[attr] += val;
        });
    });

    for (let rune of runeList) {
        Object.entries(rune.attrs.basic).forEach(([attr, val]) => {
            stats[attr] += val;
        });
    }

    Object.entries(fightPet?.fightAttrs || {}).forEach(([attr, val]) => {
        stats[attr] += val;
    });

    return {
        weaponList,
        fightPet,
        runeList,
        stats
    };
}