var int = require("ble_hid_combo");
NRF.setServices(undefined, { hid: int.report });

var GESTURE_DETECTION_SPEEDC = 20;
var GESTURE_DETECTION_SPEEDN = 30;
var GESTURE_DURATION = 20;        
var USE_BLE = 1;                  
var on = true;                    
var complexMode = false;          
var cursorMode = false;           
var oldX = 0, oldY = 0;           
var deltaX = 0;                   

var lastGestureDir = null;

var lastButtonPressTime = 0;      
var buttonPressCount = 0;         
const DOUBLE_PRESS_INTERVAL = 700; 

var buttonPressStartTime = 0; 
var buttonHoldDuration = 0;   

var sendonekeypress = true;       
var sendmultykeypress = false;    
var tiltStartTime = 0;            
var multiPressIntervalId = null;  

const MULTI_KEYPRESS_DELAY = 1000;  
const baseSensitivity = 2000;        
const minSpeed = 0.01;              
const maxSpeed = 40;                
const sensitivity = 800;           
let detect = 0;

const DEBOUNCE_TIME = 300; 
let debounce = false;      

const LONG_PRESS_THRESHOLD = 1000;

let D1PressStartTime = 0; 
let D2PressStartTime = 0; 
let D1LongPressed = false; 
let D2LongPressed = false; 

function flashLED(ledPin, times, interval) {
  let count = 0;
  let id = setInterval(() => {
    ledPin.write(!ledPin.read());
    count++;
    if (count >= times * 2) {
      clearInterval(id);
      ledPin.write(false);
    }
  }, interval);
}

function checkBatteryOnStartup() {
  let lvl=0, volt=0;
  try { lvl = E.getBattery(); } catch(e){}
  try { volt=NRF.getBattery(); } catch(e){}
  console.log("[Battery] Level:", lvl, "%, Voltage:", volt, "V");
  if (lvl>50) {
    flashLED(LED2, 2, 300);
  } else if (lvl>20) {
    flashLED(LED3, 2, 300);
  } else {
    flashLED(LED1, 2, 300);
  }
}

pinMode(D2, "input_pullup");
pinMode(D1, "input_pullup");

let lastButtonActivityTime = Date.now();
let isUpright = false;
let uprightSince = 0;
let isRestMode = false;

setWatch(() => {
  if (isRestMode) return;
  D2PressStartTime = Date.now();
  console.log("External Button D2 pressed");
  lastButtonActivityTime = Date.now();
}, D2, { edge: "falling", debounce: 50, repeat: true });

setWatch(() => {
  if (isRestMode) return;
  const pressDuration = Date.now() - D2PressStartTime;
  lastButtonActivityTime = Date.now();
  if (pressDuration > LONG_PRESS_THRESHOLD) {
    D2LongPressed = true;
    console.log("D2 Long Press detected");
  } else {
    D2LongPressed = false;
    sendMouseClick(int.BUTTON.LEFT);
    console.log("External Button D2 => Mouse LEFT CLICK");
  }
  D2PressStartTime = 0;
}, D2, { edge: "rising", debounce: 50, repeat: true });

setWatch(() => {
  D1PressStartTime = Date.now();
  if (isRestMode) {
    console.log("External Button D1 pressed (in Rest Mode)");
  } else {
    console.log("External Button D1 pressed");
    lastButtonActivityTime = Date.now();
  }
}, D1, { edge: "falling", debounce: 50, repeat: true });

setWatch(() => {
  const pressDuration = Date.now() - D1PressStartTime;
  if (isRestMode) {
    if (pressDuration > 3000) {
      exitRestMode();
    }
  } else {
    lastButtonActivityTime = Date.now();
    if (pressDuration > LONG_PRESS_THRESHOLD) {
      D1LongPressed = true;
      console.log("D1 Long Press detected");
    } else {
      D1LongPressed = false;
      sendMouseClick(int.BUTTON.RIGHT);
      console.log("External Button D1 => Mouse RIGHT CLICK");
    }
  }
  D1PressStartTime = 0;
}, D1, { edge: "rising", debounce: 50, repeat: true });

function sendKeyPress(keyCode) {
  try {
    int.tapKey(keyCode);
  } catch (error) {
    console.log("Key press error:", error);
  }
}

function sendMouseClick(buttonMask) {
  try {
    int.clickButton(buttonMask);
    console.log("Mouse click with buttonMask =", buttonMask);
  } catch (e) {
    console.log("Mouse click error:", e);
  }
}

function moveMouse(dx, dy) {
  try {
    int.moveMouse(dx, dy);
  } catch (error) {
    console.log("Mouse move error:", error);
  }
}

function resetModes() {
  complexMode = false;
  cursorMode = false;
  oldX = 0;
  oldY = 0;
  lastGestureDir = null;
}

let singlePressTimeout = null;
function handleShortPress() {
  if (!cursorMode || debounce) return;
  const now = Date.now();
  const elapsed = now - lastButtonPressTime;
  debounce = true;
  setTimeout(() => debounce = false, DEBOUNCE_TIME);
  if (elapsed < DOUBLE_PRESS_INTERVAL) {
    buttonPressCount++;
    if (buttonPressCount === 2) {
      console.log("Double Press => Space");
      sendKeyPress(0x2C);
      if (singlePressTimeout) {
        clearTimeout(singlePressTimeout);
        singlePressTimeout = null;
      }
      buttonPressCount = 0;
    }
  } else {
    buttonPressCount = 1;
    singlePressTimeout = setTimeout(() => {
      if (buttonPressCount === 1) {
        console.log("Single Press => Enter");
        sendKeyPress(int.KEY.ENTER);
      }
      buttonPressCount = 0;
      singlePressTimeout = null;
    }, DOUBLE_PRESS_INTERVAL);
  }
  lastButtonPressTime = now;
}

function checkButton() {
  if (digitalRead(BTN) === 1) {
    if (buttonPressStartTime === 0) {
      buttonPressStartTime = Date.now();
    }
  } else {
    if (buttonPressStartTime > 0) {
      buttonHoldDuration = Date.now() - buttonPressStartTime;
      console.log("Onboard Button hold duration:", buttonHoldDuration, "ms");
      buttonPressStartTime = 0;
    }
  }
}
setInterval(checkButton, 100);

let currentDownKey = null;
function keyDownIfNotAlready(newKey) {
  if (currentDownKey !== newKey) {
    if (currentDownKey !== null) {
      int.keyUp(currentDownKey);
      console.log("keyUp on old direction:", currentDownKey);
    }
    currentDownKey = newKey;
    int.keyDown(newKey);
    console.log("keyDown on direction:", newKey);
  }
}
function releaseCurrentKey() {
  if (currentDownKey !== null) {
    int.keyUp(currentDownKey);
    console.log("keyUp on direction:", currentDownKey);
    currentDownKey = null;
  }
}

function enterRestMode() {
  if (!isRestMode) {
    console.log("==> Entering Rest Mode...");
    isRestMode = true;
    Puck.accelOff();
    LED1.write(false);
    LED2.write(false);
    LED3.write(false);
  }
}

function exitRestMode() {
  if (isRestMode) {
    console.log("==> Exiting Rest Mode...");
    isRestMode = false;
    Puck.accelOn(26);
    isUpright = false;
    flashLED(LED1, 2, 300);
  }
}

function onAccel(a) {
  if (isRestMode) return;
  if ((digitalRead(BTN) === 1 && buttonHoldDuration > 1000) ||
      D1LongPressed ||
      D2LongPressed) {
    LED3.write(true);
    if (
      (a.acc.x < -sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) ||
      D1LongPressed
    ) {
      complexMode = true;
      cursorMode = false;
      console.log("Switched to Complex Mode");
      D1LongPressed = false;
      LED2.write(true);
      setTimeout(() => {
        LED2.write(false);
      }, 2000);
    }
    else if (
      (a.acc.x > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) ||
      D2LongPressed
    ) {
      cursorMode = true;
      complexMode = false;
      console.log("Switched to Cursor Mode");
      D2LongPressed = false;
      LED2.write(true);
      setTimeout(() => {
        LED2.write(false);
      }, 1000);
    }
    else if (a.acc.y < -sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      resetModes();
      console.log("Switched to Normal Mode");
      LED1.write(true);
      setTimeout(() => {
        LED1.write(false);
      }, 1000);
    }
    setTimeout(()=>buttonHoldDuration=0,500);
    return; 
  } else {
    LED3.write(false);
  }

  let isUprightNow = (Math.abs(a.acc.x) < sensitivity && Math.abs(a.acc.y) < sensitivity);
  if (isUprightNow && !isUpright) {
    isUpright = true;
    uprightSince = Date.now();
  } else if (!isUprightNow) {
    isUpright = false;
    uprightSince = 0;
  }

  let x = 0, y = 0;
  if (!isUprightNow) {
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);
    const dynamicSpeedX = tiltX < baseSensitivity
      ? minSpeed + Math.pow(tiltX / baseSensitivity,3) * (maxSpeed - minSpeed)
      : maxSpeed;
    const dynamicSpeedY = tiltY < baseSensitivity
      ? minSpeed + Math.pow(tiltY / baseSensitivity,3) * (maxSpeed - minSpeed)
      : maxSpeed;
    x = (a.acc.x > 0) ? -dynamicSpeedX : dynamicSpeedX;
    y = (a.acc.y < 0) ? -dynamicSpeedY : dynamicSpeedY;
  }

  deltaX = Math.abs(x - oldX);
  const deltaY = Math.abs(y - oldY);
  oldX = x;
  oldY = y;

  if (cursorMode && !complexMode && detect === 0) {
    let isButtonPressed = (digitalRead(BTN) === 1);
    if (isUprightNow) {
      tiltStartTime = 0; 
      sendonekeypress = true;
      sendmultykeypress = false;
      releaseCurrentKey();
      if (isButtonPressed && buttonHoldDuration < 1000) {
        handleShortPress();
      }
      return;
    }
    if (!isButtonPressed) {
      if (tiltStartTime === 0) {
        tiltStartTime = Date.now();
      }
      const tiltDuration = Date.now() - tiltStartTime;
      if (tiltDuration < MULTI_KEYPRESS_DELAY && sendonekeypress) {
        console.log("Single direction key press (cursorMode)");
        if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
          sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT);
        } else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
          sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN);
        }
        sendonekeypress = false; 
      }
      else if (tiltDuration >= MULTI_KEYPRESS_DELAY) {
        if (!sendmultykeypress) {
          console.log("Start holding keyDown (cursorMode)");
          sendmultykeypress = true;
        }
        if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
          keyDownIfNotAlready(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT);
        } else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
          keyDownIfNotAlready(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN);
        } else {
          releaseCurrentKey();
        }
      }
    } else {
      releaseCurrentKey();
      sendmultykeypress = false;
      sendonekeypress = true;
    }
    return;
  }

  if (complexMode) {
    if (deltaX > GESTURE_DETECTION_SPEEDC || deltaY > GES-TURE_DETECTION_SPEEDC) {
      detect = GESTURE_DURATION;
      LED3.write(true);
      if (Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
        if (a.acc.x < 0) lastGestureDir = "right";
        else lastGestureDir = "left";
      } else {
        if (a.acc.y < 0) lastGestureDir = "forward";
        else lastGestureDir = "back";
      }
      console.log("Detected fast move in complexMode, direction =", lastGestureDir);
    }
    if (detect > 0) {
      detect--;
      if (detect === 0) LED3.write(false);
    }
    if (detect === 0 && lastGestureDir !== null && isUprightNow) {
      switch (lastGestureDir) {
        case "left":
          sendMouseClick(int.BUTTON.LEFT);
          console.log("Complex gesture => left mouse click");
          break;
        case "right":
          sendMouseClick(int.BUTTON.RIGHT);
          console.log("Complex gesture => right mouse click");
          break;
        case "forward":
          sendKeyPress(int.KEY.ENTER);
          console.log("Complex gesture => ENTER");
          break;
        case "back":
          sendKeyPress(int.KEY.BACKSPACE);
          console.log("Complex gesture => BACKSPACE");
          break;
      }
      lastGestureDir = null;
    }
  }

  if (on && USE_BLE && !cursorMode) {
    if (deltaX > GESTURE_DETECTION_SPEEDN || deltaY > GES-TURE_DETECTION_SPEEDN) {
      detect = GESTURE_DURATION; 
      LED3.write(true);
    }
    if (detect > 0) {
      detect--;
      if (detect === 0) LED3.write(false);
    } else {
      if (x !== 0 || y !== 0) {
        moveMouse(x, y);
      }
    }
  }
}

Puck.accelOn(26);
Puck.on('accel', onAccel);

if (USE_BLE) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" });
}
checkBatteryOnStartup();
console.log("BLE Joystick ready");
setInterval(() => {
  if (!isRestMode) {
    const now = Date.now();
    if (isUpright && (now - uprightSince > 10000) && (now - lastButtonActivityTime > 10000)) {
      enterRestMode();
    }
  }
}, 2000);
