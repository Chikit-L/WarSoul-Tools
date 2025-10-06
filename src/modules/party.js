import { registMessageHandler, registSendHookHandler, requestIdCounter, wsSend } from "./connection";
import { parseWSmessage } from "./utils";

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
  const playerId = obj[0].data.id;
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