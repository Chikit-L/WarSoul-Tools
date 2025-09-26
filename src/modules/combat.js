import { registMessageHandler } from "./connection.js";

// 判断战斗时间内是否能打过
let maxTime = 0;

setInterval(() => {
  const dungeonPage = document.querySelector('.dungeon-page');
  let fightPage = dungeonPage.querySelector('.person-fight');
  if (!dungeonPage ) {
    return;
  }
  if (fightPage.style.display === 'none') {
    fightPage = dungeonPage.querySelector('.team-fight');
  }
  if (fightPage.style.display !== 'none') {
    const timerEls = fightPage?.querySelectorAll('.fight-over-timer');
    const timerEl = timerEls[timerEls.length - 1];
    const timeLeft = parseFightTime(timerEl.innerText);
    if (maxTime === 0 && timeLeft > 30) {
      maxTime = 180;
    } else if (maxTime === 0 && timeLeft > 10) {
      maxTime = 30;
    }
    const timeLeftPercent = (timeLeft / maxTime);
    const hpEl = fightPage.querySelector('.el-progress-bar__innerText');
    const hpLeftPercent = parseFloat(hpEl.innerText.replace(' %', '')) / 100;

    let diffEl = timerEl.parentElement.querySelector('.time-diff-indicator');
    if (!diffEl) {
      diffEl = document.createElement('div');
      diffEl.className = 'time-diff-indicator';
      diffEl.style.fontSize = '12px';
      diffEl.style.textAlign = 'center';
      timerEl.parentElement.appendChild(diffEl);
    }

    if (timeLeftPercent < hpLeftPercent - 0.02) {
      diffEl.style.backgroundColor = 'red';
    } else if (timeLeftPercent < hpLeftPercent + 0.01) {
      diffEl.style.backgroundColor = 'orange';
    } else if (timeLeftPercent < hpLeftPercent + 0.03) {
      diffEl.style.backgroundColor = 'yellow';
    } else {
      diffEl.style.backgroundColor = 'green';
    }
    
    diffEl.innerText = `(${((timeLeftPercent-hpLeftPercent)*100).toFixed(2)}%)`;

  } else {
    maxTime = 0;
  }
}, 1000);


export function parseFightTime(timeStr) {
  const [minutes, seconds] = timeStr.split(' : ').map(num => parseInt(num, 10));
  return minutes * 60 + seconds;
}


// Actual attack speed calculation
const atkList = [];

registMessageHandler(/^42\["fightRes/, (obj) => {
    const atkInfoList = obj[1].atkInfoList;
    atkList.push({
      atk: atkInfoList,
      timestamp: Date.now()
    });
    if (atkList.length > 500) {
      atkList.shift();
    }
});

setInterval(() => {
  const fightPage = document.querySelector('.fight-page');
  if (!fightPage || fightPage.style.display === 'none' || atkList.length < 1) {
    return;
  }
  const totalAtk = atkList.reduce((sum, atkInfo) => sum + atkInfo.atk.length, 0);
  const avgBasicAtkSpd = (atkList.length / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000));
  const avgAtkSpd = (totalAtk / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000));

  const fightUserList = document.querySelector('.fight-user-list');

  const hitAccuracy = atkList.reduce((sum, atkInfo) => {
    const unhitCount = atkInfo.atk.filter(atk => atk.unHit).length;
    return sum + (atkInfo.atk.length > 0 ? atkInfo.atk.length - unhitCount : 0);
  }, 0) / totalAtk;
  const criticalRate = atkList.reduce((sum, atkInfo) => {
    const criticalNum = atkInfo.atk.filter(atk => atk.trigger.includes('暴击')).length;
    return sum + (atkInfo.atk.length > 0 ? criticalNum : 0);
  }, 0) / totalAtk;

  let atkEl = document.querySelector('.actual-atk-speed');
  if (!atkEl) {
    atkEl = document.createElement('div');
    atkEl.className = 'actual-atk-speed';
    fightUserList.appendChild(atkEl);
  }
  atkEl.style.fontSize = '8px';
  atkEl.innerText = `实际攻速: ${avgAtkSpd.toFixed(3)}(${avgBasicAtkSpd.toFixed(3)}) 次/秒`;
  atkEl.appendChild(document.createElement('br'));
  atkEl.innerText += `命中率: ${(hitAccuracy * 100).toFixed(2)}% 暴击率: ${(criticalRate * 100).toFixed(2)}%`;
}, 1000)
