import { getUserInfo } from "./character";
import { registMessageHandler, registSendHookHandler, requestIdCounter, wsSend} from "./connection";
import { logMessage } from "./utils";

export function injectDebugTool() {
  const mainElement = document.querySelector('.main');
  if (mainElement) {
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug';
    debugButton.className = 'debug-tool-button';
    mainElement.insertBefore(debugButton, mainElement.firstChild);

    debugButton.addEventListener('click', () => {
      debug();
    });
  }
}

function debug() {
  logMessage('Debugging...');
  logMessage(`Now requestIdCounter: ${requestIdCounter}`);
  // getUserInfo(30124);
}