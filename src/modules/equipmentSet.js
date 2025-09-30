import { loadFromLocalStorage, saveToLocalStorage, logMessage } from "./utils";
import { equipEquipment, equipPet, equipRune, unequipRune } from "./equipments";
import { characterInfo, refreshCharacterInfo } from "./character";

export const localEquipmentSet = loadFromLocalStorage("equipmentsSetLocal", {});

export function saveEquipmentSet(name) {
  const equipmentSet = {
    name,
    equippedList: characterInfo.equippedList,
    runeEquippedList: characterInfo?.runeEquippedList,
    relicEquippedList: characterInfo?.relicEquippedList,
    fightPetId: characterInfo?.fightPetId,
  };
  localEquipmentSet[name] = equipmentSet;
  saveToLocalStorage("equipmentsSetLocal", localEquipmentSet);
}

export function applyFromEquipmentSet(name) {
  const equipmentSet = localEquipmentSet[name];
  if (!equipmentSet) {
    logMessage(`Equipment set ${name} not found`);
    return;
  }

  Object.values(equipmentSet.equippedList).forEach(equipment => {
    equipEquipment(equipment.id);
  });

  characterInfo.runeEquippedList?.forEach((runeId, index) => {
    if (runeId) {
      unequipRune(runeId);
    }
  });

  equipmentSet.runeEquippedList?.forEach((runeId, index) => {
    if (runeId) {
      equipRune(runeId, index);
    }
  });

  equipPet(equipmentSet.fightPetId);

  setTimeout(() => {
    refreshCharacterInfo();
  }, 500);
}

function addLocalEquipmentSetPanel() {
  const equipList = document.querySelector('.equip-list');
  const elSelect = equipList.querySelector('.el-select');

  const equipmentSetPanel = document.createElement('div');
  equipmentSetPanel.className = 'equipment-set-panel';


  // 创建控制区域
  const controlArea = document.createElement('div');
  controlArea.style.cssText = `
    display: flex;
    align-items: center;
    padding: 3px;
    gap: 3px;
  `;

  // 创建套装选择器
  const setSelector = document.createElement('select');
  setSelector.className = 'equipment-set-selector';
  setSelector.style.cssText = `
    flex: 1;
    font-size: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
  `;

  // 更新选择器选项
  function updateSelectorOptions() {
    setSelector.innerHTML = '<option value="">选择套装...</option>';
    Object.keys(localEquipmentSet).forEach(setName => {
      const option = document.createElement('option');
      option.value = setName;
      option.textContent = setName;
      setSelector.appendChild(option);
    });
  }

  // 创建添加按钮
  const addButton = document.createElement('button');
  addButton.textContent = '+';
  addButton.title = '保存当前装备为新套装';
  addButton.style.cssText = `
    border: 1px solid #4CAF50;
    border-radius: 4px;
    background-color: #4CAF50;
    color: white;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  addButton.addEventListener('click', () => {
    const setName = prompt('请输入套装名称:');
    if (setName && setName.trim()) {
      saveEquipmentSet(setName.trim());
      updateSelectorOptions();
      setSelector.value = setName.trim();
      logMessage(`套装 "${setName.trim()}" 已保存`);
    }
  });

  // 创建删除按钮
  const deleteButton = document.createElement('button');
  deleteButton.textContent = '-';
  deleteButton.title = '删除选中的套装';
  deleteButton.style.cssText = `
    border: 1px solid #f44336;
    border-radius: 4px;
    background-color: #f44336;
    color: white;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  deleteButton.addEventListener('click', () => {
    const selectedSet = setSelector.value;
    if (!selectedSet) {
      alert('请先选择要删除的套装');
      return;
    }
    
    if (confirm(`确定要删除套装 "${selectedSet}" 吗？`)) {
      delete localEquipmentSet[selectedSet];
      saveToLocalStorage("equipmentsSetLocal", localEquipmentSet);
      updateSelectorOptions();
      logMessage(`套装 "${selectedSet}" 已删除`);
    }
  });

  // 创建应用按钮
  const applyButton = document.createElement('button');
  applyButton.textContent = '应用';
  applyButton.title = '应用选中的套装';
  applyButton.style.cssText = `
    font-size: 10px;
    border: 1px solid #2196F3;
    border-radius: 4px;
    background-color: #2196F3;
    color: white;
    cursor: pointer;
  `;

  applyButton.addEventListener('click', () => {
    const selectedSet = setSelector.value;
    if (!selectedSet) {
      alert('请先选择要应用的套装');
      return;
    }
    
    applyFromEquipmentSet(selectedSet);
    logMessage(`套装 "${selectedSet}" 已应用`);
  });

  // 套装选择变化事件
  setSelector.addEventListener('change', () => {
    const selectedSet = setSelector.value;
    if (selectedSet) {
      // 可以在这里添加预览功能
    }
  });

  // 组装控制区域
  controlArea.appendChild(setSelector);
  controlArea.appendChild(addButton);
  controlArea.appendChild(deleteButton);
  controlArea.appendChild(applyButton);

  // 组装面板
  equipmentSetPanel.appendChild(controlArea);

  // 初始化选择器选项
  updateSelectorOptions();

  elSelect.insertAdjacentElement('afterend', equipmentSetPanel);
}

// 初始化装备套装面板
export function initEquipmentSetPanel() {
  // 等待页面元素加载完成
  const checkAndInit = () => {
    const equipList = document.querySelector('.equip-list');
    if (equipList) {
      addLocalEquipmentSetPanel();
    } else {
      setTimeout(checkAndInit, 1000);
    }
  };
  
  setTimeout(checkAndInit, 2000);
}