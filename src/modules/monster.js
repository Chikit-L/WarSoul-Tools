import { characterInfo, getDps } from "./character";
import { monsterEffects } from "./effects";
import { segmentsParse } from "./equipments";
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

  const monsterInfo = {
    name: monsterName,
    hpMax: parseFloat(getP('血量：')),
    defense: parseFloat(getP('防御：')),
    evasion: parseFloat(getP('闪避率：').replace('%', '')),
    antiCrit: parseFloat(getP('抗爆率：').replace('%', ''))
  }

  const specials = monsterCard.querySelectorAll('.special');
  const specialList = [];
  const ignoreSpecials = [];
  for (let special of specials) {
    const title = special.innerText;
    const ability = monsterEffects[title];
    if (ability) {
      specialList.push(ability);
    } else {
      ignoreSpecials.push(title);
    }
  }

  const fightRes = calculateMonsterTime(monsterInfo, specialList);
  
  let timeElem = monsterCard.querySelector('.monster-time-to-kill');
  if (!timeElem) {
    timeElem = document.createElement('div');
    timeElem.className = 'monster-time-to-kill';
    timeElem.style.marginTop = '8px';
    timeElem.style.fontWeight = 'bold';
  }
  
  timeElem.innerHTML = `击杀所需时间: ${fightRes.useTime < 0 ? '∞' : fightRes.useTime.toFixed(2)} 秒`;
  if (fightRes.useTimeSeg.length > 1) {
    timeElem.innerHTML += fightRes.useTimeSeg.map(seg => {
      const hpRange = `${(seg.prevHpPercent).toFixed(1)}%→${(seg.currentHpPercent).toFixed(1)}%`;
      const time = `${seg.segUseTime < 0 ? '∞' : seg.segUseTime.toFixed(2)}秒`;
      return `<br><span style="display: inline-block;">${hpRange}</span><span style="float: right;">${time}</span>`;
    }).join('');
  }

  if (ignoreSpecials.length > 0) {
    timeElem.innerHTML += `<br>(不考虑 ${ignoreSpecials.join('、')} 特效下)`;
  }
  if (characterInfo.parsed.stats.ignoreSpecials.length > 0) {
    timeElem.innerHTML += `<br>（不考虑角色装备中的 ${characterInfo.parsed.stats.ignoreSpecials.join('、')} 特效下）`;
  }
  monsterCard.appendChild(timeElem);
}

function calculateMonsterTime(monsterInfo, specials) {
  let useTime = 0;
  const stats = characterInfo.parsed.stats;
  const monsterHpSegments = [];
  const useTimeSeg = [];
  specials.forEach(ability => {
    ability(stats, monsterHpSegments, monsterInfo);
  });

  const segments = segmentsParse(stats, monsterHpSegments);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    // 计算当前分段的HP百分比范围
    const currentHpPercent = seg.hpPercent || 0;
    const prevHpPercent = i > 0 ? (segments[i - 1].hpPercent || 100) : 100;
    const hpPercentDiff = prevHpPercent - currentHpPercent;
    
    // 计算实际分段HP
    const segmentHp = monsterInfo.hpMax * (hpPercentDiff / 100);

    // 计算部分特殊效果
    seg.specialFunc?.forEach(f => f(seg));

    const dps = getDps(
      seg,
      monsterInfo.defense + (seg.monsterDefense || 0),
      monsterInfo.evasion + (seg.monsterEvasion || 0),
      monsterInfo.antiCrit + (seg.monsterAntiCrit || 0)
    );
    const segUseTime = segmentHp / dps;
    if (dps <= 0) {
      return {
        useTime: -1,
        useTimeSeg: [...useTimeSeg, { currentHpPercent, prevHpPercent, segUseTime: -1 }]
      };
    } else {
      useTime += segUseTime;
      useTimeSeg.push({ currentHpPercent, prevHpPercent, segUseTime });
    }
  }
  logMessage(segments);
  return {
    useTime,
    useTimeSeg
  };
}
