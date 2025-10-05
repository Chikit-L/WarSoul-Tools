import { registMessageHandler } from "./connection.js";

// 判断战斗时间内是否能打过
let maxTime = 0;
const hpHistory = []; // 记录过去的血量百分比，用于计算变化率

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
    if (maxTime === 0 && timeLeft > 185) {
      maxTime = 300;
    } else if (maxTime === 0 && timeLeft > 30) {
      maxTime = 180;
    } else if (maxTime === 0 && timeLeft > 10) {
      maxTime = 30;
    }
    const timeLeftPercent = (timeLeft / maxTime);
    const hpEl = fightPage.querySelector('.el-progress-bar__innerText');
    const hpLeftPercent = parseFloat(hpEl.innerText.replace(' %', '')) / 100;

    // 记录血量历史，保留最近10个采样
    hpHistory.push({
      hp: hpLeftPercent,
      time: timeLeft,
      timestamp: Date.now()
    });
    if (hpHistory.length > 10) {
      hpHistory.shift();
    }

    // 计算delta（平均变化率：血量变化 / 时间变化）
    let delta = 0;
    let predictedFinalHp = hpLeftPercent;
    if (hpHistory.length >= 2) {
      const oldestSample = hpHistory[0];
      const newestSample = hpHistory[hpHistory.length - 1];
      const hpChange = newestSample.hp - oldestSample.hp; // 注意：血量是减少的，所以这个值应该是负数
      const timeChange = oldestSample.time - newestSample.time; // 时间是减少的，所以用旧-新
      
      if (timeChange > 0) {
        delta = hpChange / timeChange; // 每秒血量变化率（负数表示减少）
        // 基于当前血量和变化率预测最终血量
        predictedFinalHp = hpLeftPercent + (delta * timeLeft);
        // 限制预测值在合理范围内
        predictedFinalHp = Math.max(0, Math.min(1, predictedFinalHp));
      }
    }

    let diffEl = timerEl.parentElement.querySelector('.time-diff-indicator');
    if (!diffEl) {
      diffEl = document.createElement('div');
      diffEl.className = 'time-diff-indicator';
      diffEl.style.fontSize = '12px';
      diffEl.style.textAlign = 'center';
      timerEl.parentElement.appendChild(diffEl);
    }

    // 根据预测最终血量调整颜色
    if (predictedFinalHp > 0.05) {
      diffEl.style.backgroundColor = 'red';
    } else if (predictedFinalHp > 0.02) {
      diffEl.style.backgroundColor = 'orange';
    } else if (predictedFinalHp > -0.02) {
      diffEl.style.backgroundColor = 'yellow';
    } else {
      diffEl.style.backgroundColor = 'green';
    }

    const diff = (timeLeftPercent - hpLeftPercent);
    
    diffEl.innerText = `(${(diff*100).toFixed(2)}%)`;
    if (hpHistory.length >= 2) {
      diffEl.innerHTML += `<br>Δ: ${(delta*1000).toFixed(3)}%/s<br>预测最终: ${(predictedFinalHp*100).toFixed(2)}%`;
    }

  } else {
    maxTime = 0;
    hpHistory.length = 0; // 清空历史记录
  }
}, 1000);


export function parseFightTime(timeStr) {
  const [minutes, seconds] = timeStr.split(' : ').map(num => parseInt(num, 10));
  return minutes * 60 + seconds;
}


// Actual attack speed calculation
const atkList = [];
let isAdvanceFight = false;

registMessageHandler(/^42\["fightRes/, (obj) => {
    const atkInfoList = obj[1].atkInfoList;
    atkList.push({
      atk: atkInfoList,
      timestamp: Date.now()
    });
    if (atkList.length > 500) {
      atkList.shift();
    }
    isAdvanceFight = false;
});

registMessageHandler(/^42\["advanceFightRes/, (obj) => {
    const atkInfoList = obj[1].atkInfoList;
    atkList.push({
      atk: atkInfoList,
      timestamp: Date.now()
    });
    if (atkList.length > 500) {
      atkList.shift();
    }
    isAdvanceFight = true;
});

setInterval(() => {
  const fightPage = document.querySelector('.fight-page');
  if (!fightPage || fightPage.style.display === 'none' || atkList.length < 1) {
    return;
  }
  const totalAtk = atkList.reduce((sum, atkInfo) => sum + atkInfo.atk.length, 0);
  const avgBasicAtkSpd = (atkList.length / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000));
  const avgAtkSpd = (totalAtk / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000));

  const fightUserList = document.querySelectorAll('.fight-user-list')[isAdvanceFight ? 1 : 0];

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
