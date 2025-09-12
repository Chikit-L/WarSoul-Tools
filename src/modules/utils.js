
export function removeLeadingNumbers(str) {
  return str.replace(/^\d+/, '');
}

export function logMessage(message) {
  console.log("[WarSoul-Tools]", message);
}