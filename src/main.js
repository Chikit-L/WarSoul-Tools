import { hookWS, hookHTTP } from "./modules/connection";
import { characterInfo } from "./modules/character";
import { logMessage } from "./modules/utils";
import { parseFightTime } from "./modules/combat";
import {} from './modules/fishing';

hookWS();
hookHTTP();

logMessage("WarSoul-Tools loaded.");