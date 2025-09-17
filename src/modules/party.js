import { registMessageHandler, wsSend } from "./connection";

// Get party rooms
registMessageHandler(/^4325/, (obj) => {
    
});

// Join party room
registMessageHandler(/^4327/, (obj) => {

});


export function joinPartyRoom(roomId) {
  wsSend(`4227["joinRoom", {roomId: ${roomId}}]`);
}

export function leavePartyRoom() {
  wsSend(`4229["quitRoom", {}]`);
}