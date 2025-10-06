import { hookWS, hookHTTP } from "./modules/connection";
import { characterInfo } from "./modules/character";
import { logMessage } from "./modules/utils";
import { parseFightTime } from "./modules/combat";
import {} from './modules/fishing';
import {} from './modules/party';
import {} from './modules/monster';
import { injectDebugTool } from "./modules/debug";
import { initEquipmentSetPanel } from "./modules/equipmentSet";

hookWS();
hookHTTP();
initEquipmentSetPanel();
// injectDebugTool();

logMessage("WarSoul-Tools loaded.");