import { characterInfo, getDps } from "./character";
import { logMessage } from "./utils";

let monsterCardShow = false;

setInterval(() => {
  let monsterCard = null;
  document.querySelectorAll('.monster-detail').forEach(el => {
    if (el.style.display !== 'none' && el.parentElement.style.display !== 'none') {
      monsterCard = el;
    }
  });
  if (monsterCard) {
    if (!monsterCardShow) {
      monsterCardShow = true;
      parseMonsterInfo(monsterCard);
    }
  } else {
    monsterCardShow = false;
  }
}, 1000);

function parseMonsterInfo(monsterCard) {
  const monsterName = monsterCard.querySelector('h3').innerText;
  const getP = (label) => {
    return Array.from(monsterCard.querySelectorAll('p')).find(p => p.innerText.startsWith(label)).innerText.replace(label, '').trim();
  }
  const hpMax = parseFloat(getP('血量：'));
  const defense = parseFloat(getP('防御：'));
  const evasion = parseFloat(getP('闪避率：').replace('%', ''));
  const antiCrit = parseFloat(getP('抗爆率：').replace('%', ''));

  const specials = monsterCard.querySelectorAll('.special');
  const specialList = [];
  const ignoreSpecials = [];
  for (let special of specials) {
    const title = special.innerText;
    const ability = monsterSpecialAbilities[title];
    if (ability) {
      specialList.push(ability);
    } else {
      ignoreSpecials.push(title);
    }
  }

  const timeToKill = calculateMonsterTime(hpMax, defense, evasion, antiCrit, specialList);
  
  
  let timeElem = monsterCard.querySelector('.monster-time-to-kill');
  if (!timeElem) {
    timeElem = document.createElement('div');
    timeElem.className = 'monster-time-to-kill';
    timeElem.style.marginTop = '8px';
    timeElem.style.fontWeight = 'bold';
  }
  
  timeElem.innerHTML = `击杀所需时间: ${timeToKill.toFixed(2)} 秒`;
  if (ignoreSpecials.length > 0) {
    timeElem.innerHTML += `<br>(不考虑 ${ignoreSpecials.join('、')} 特效下)`;
  }
  if (characterInfo.parsed.stats.ignoreSpecials.length > 0) {
    timeElem.innerHTML += `<br>（不考虑角色装备中的 ${characterInfo.parsed.stats.ignoreSpecials.join('、')} 特效下）`;
  }
  monsterCard.appendChild(timeElem);
}

function calculateMonsterTime(hpMax, defense, evasion, antiCrit, specials) {
  const stats = characterInfo.parsed.stats;
  const dps = getDps(stats, defense, evasion, antiCrit);
  const timeToKill = hpMax / dps;
  return timeToKill;
}

const monsterSpecialAbilities = {
  // '反击': () => {},
}