import { logMessage } from "./utils.js";
import { registMessageHandler } from "./connection.js";

export const characterInfo = {};

registMessageHandler(/^434/, (obj) => {
    Object.assign(characterInfo, obj[0].data);
    logMessage(`Character Info Updated ${characterInfo.id}`);
    return obj;
});
