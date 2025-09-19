import { logMessage } from "./utils.js";
import { registMessageHandler, registSendHookHandler, wsSend } from "./connection.js";

registSendHookHandler(/\["fishingCompetitionThrowRod",/, (message) => {
    const startNumber = parseInt(message.match(/^\d+/)?.[0]);
    return {
        responseRegex: new RegExp(`^${startNumber + 100}`),
        handler: (obj, other) => {
            const fishData = obj[0].data;
            const position = fishData.position;
            logMessage(`Fishing Competition: Fish appeared at position ${position}, reeling in...`);
            setTimeout(() => {
                wsSend(`${startNumber + 1}["fishingCompetitionReelIn",{"position":${position}}]`);
            }, 1000);
        }
    }
});