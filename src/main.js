import { hookWS, hookHTTP } from "./modules/connection";
import { characterInfo } from "./modules/character";
import { logMessage } from "./modules/utils";
import { parseFightTime } from "./modules/combat";

hookWS();
hookHTTP();

logMessage("WarSoul-Tools loaded.");