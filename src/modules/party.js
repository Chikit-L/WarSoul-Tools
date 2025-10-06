import { registMessageHandler, registSendHookHandler, requestIdCounter, wsSend } from "./connection";
import { parseWSmessage } from "./utils";

let autoStartFight = false;

setInterval(() => {
  const roomDiv = document.querySelector('.in-room');
  if (roomDiv) {
    if (!roomDiv.querySelector('#autoStartFightCheckbox')) {
      const label = document.createElement('label');
      label.style.marginLeft = '10px';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'autoStartFightCheckbox';
      checkbox.checked = autoStartFight;
      checkbox.addEventListener('change', (e) => {
        autoStartFight = e.target.checked;
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' 自动开始战斗'));
      roomDiv.appendChild(label);
    }
  }
}, 1000);

// Get party rooms
registSendHookHandler(/\["getTeamFightRoom",/, (message) => {
  const obj = parseWSmessage(message);
  const rooms = obj[0].data;
});

// Join party room
registSendHookHandler(/\["joinRoom",/, (message) => {
  const obj = parseWSmessage(message);
  const monster = obj[0].data.monster;
});

// Cancel party fight
registSendHookHandler(/\["cancelTeamFight",/, (message) => {

});

registMessageHandler(/\["nestPlayerJoin",/, (obj) => {
  // const playerId = obj[1].id;
  if (autoStartFight) {
    let roomType = document.querySelector('.in-room')?.querySelector('.affix')?.querySelector('span')?.class || 'relic';
    if (roomType === 'relic') {
      roomType = 'relicRuin';
    }
    setInterval(() => {
      startFight(roomType);
    }, 1000);
  }
});


export function joinPartyRoom(roomId) {
  wsSend(`42${requestIdCounter}["joinRoom", {roomId: ${roomId}}]`);
}

export function leavePartyRoom() {
  wsSend(`42${requestIdCounter}["quitRoom", {}]`);
}

export function startFight(type) {
  // type: crack, relicRuin
  type = type.charAt(0).toUpperCase() + type.slice(1);
  wsSend(`42${requestIdCounter}["start${type}Fight", {}]`);
}