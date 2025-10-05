import { logMessage } from "./utils.js";
import { registMessageHandler, registSendHookHandler, wsSend } from "./connection.js";

registSendHookHandler(/\["fishingCompetitionThrowRod",/, (message) => {
    const startNumber = parseInt(message.match(/^\d+/)?.[0]);
    const returnButton = Array.from(document.querySelector('.fishing-competition').querySelectorAll('button')).find(btn => btn.innerText === '返回');
    return {
        responseRegex: new RegExp(`^${startNumber + 100}`),
        handler: (obj, other) => {
            const fishData = obj[0].data;
            const position = fishData.position;
            logMessage(`Fishing Competition: Fish appeared at position ${position} est size ${fishData.size}, reeling in...`);
            setTimeout(() => {
                wsSend(`${startNumber + 1}["fishingCompetitionReelIn",{"position":${position}}]`);
                if (returnButton) {
                    returnButton.click();
                }
            }, 1000);
        }
    }
});