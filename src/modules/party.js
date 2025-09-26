import { registMessageHandler, requestIdCounter, wsSend } from "./connection";

// Get party rooms
registMessageHandler(/^4325/, (obj) => {
    
});

// Join party room
registMessageHandler(/^4327/, (obj) => {

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

export function startPartyCrackFight() {
  wsSend(`42${requestIdCounter}["startCrackFight", {}]`);
}