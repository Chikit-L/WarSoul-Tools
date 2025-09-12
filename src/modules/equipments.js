import { registHTTPRequestHandler } from "./connection";
import { logMessage } from "./utils";

export const equipmentsData = {}

registHTTPRequestHandler(/awakening-of-war-soul-ol\/socket\.io/, /.*/, /^430.+/, (res) => {
  Object.assign(equipmentsData, res[0].data);
  logMessage(`Equipments Data Updated, total ${Object.keys(equipmentsData).length} items`);
  return res;
});
