import { hookWS, hookHTTP } from "./modules/connection";
import { characterInfo } from "./modules/character";
import { logMessage } from "./modules/utils";

hookWS();
hookHTTP();

logMessage("WarSoul-Tools loaded.");