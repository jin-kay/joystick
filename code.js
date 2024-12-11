// Importiert ble_hid_combo-Modul für HID-Funktionalität
var int = require("ble_hid_combo");

// Initialisiert den Bluetooth HID-Dienst
NRF.setServices(undefined, { hid: int.report });

// Konfiguriert Parameter für Gestenerkennung
var GESTURE_DETECTION_SPEED = 15;
var GESTURE_DURATION = 20;
var USE_BLE = 1;
var on = true;
var complexMode = false;
var cursorMode = false;
var oldX = 0, oldY = 0;
var deltaX = 0;

// Empfindlichkeits- und Geschwindigkeitsparameter
const baseSensitivity = 3000;
const minSpeed = 0.01;
const maxSpeed = 35;
const sensitivity = 1000;

let detect = 0;

// Sendet Tastendrücke
function sendKeyPress(keyCode) {
  try {
    int.tapKey(keyCode);
    setTimeout(() => int.tapKey(0), 50);
  } catch (error) {
    console.log("Fehler beim Senden eines Tastendrucks:", error);
  }
}

// Bewegt die Maus
function moveMouse(dx, dy) {
  try {
    int.moveMouse(dx, dy);
  } catch (error) {
    console.log("Fehler bei der Mausbewegung:", error);
  }
}

// Setzt Modi und Beschleunigungswerte zurück
function resetModes() {
  complexMode = false;
  cursorMode = false;
  oldX = 0;
  oldY = 0;
}

// Handhabt Ereignisse des Beschleunigungsmessers
function onAccel(a) {
  // Prüft, ob der Button gedrückt ist und wechselt den Modus
  if (digitalRead(BTN) === 1) {
    LED3.write(true);
    if (a.acc.x < -sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      complexMode = true;
      cursorMode = false;
    } else if (a.acc.x > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      cursorMode = true;
      complexMode = false;
    } else if (a.acc.y < sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      resetModes();
    }
    return;
  } else {
    LED3.write(false);
  }

  // Cursor-Modus: Sendet Tastendrücke
  if (cursorMode && !complexMode && detect == 0) {
    if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT);
    } else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN);
    }
    return;
  }

  // Berechnet Mausbewegungen basierend auf Neigung
  let x = 0, y = 0;
  if (Math.abs(a.acc.x) >= sensitivity || Math.abs(a.acc.y) >= sensitivity) {
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);
    const dynamicSpeedX = tiltX < baseSensitivity ? minSpeed + (tiltX / baseSensitivity) ** 2 * (maxSpeed - minSpeed) : maxSpeed;
    const dynamicSpeedY = tiltY < baseSensitivity ? minSpeed + (tiltY / baseSensitivity) ** 2 * (maxSpeed - minSpeed) : maxSpeed;
    x = a.acc.x > 0 ? -dynamicSpeedX : dynamicSpeedX;
    y = a.acc.y < 0 ? -dynamicSpeedY : dynamicSpeedY;
  }

  // Gestenerkennung und Cooldown-Logik
  deltaX = Math.abs(x - oldX);
  const deltaY = Math.abs(y - oldY);
  oldX = x;
  oldY = y;
  if (complexMode && (deltaX > GESTURE_DETECTION_SPEED || deltaY > GESTURE_DETECTION_SPEED)) {
    detect = GESTURE_DURATION;
    LED3.write(true);
  }
  if (detect > 0) {
    detect--;
    if (detect == 0) LED3.write(false);
  }

  // Bewegt die Maus nur in normalen und komplexen Modi
  if (on && USE_BLE && detect == 0 && !cursorMode) {
    if (x !== 0 || y !== 0) moveMouse(x, y);
  }
}

// Aktiviert Beschleunigungsmesser und Bluetooth
Puck.accelOn(26);
Puck.on('accel', onAccel);
if (USE_BLE) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" });
}

console.log('BLEJoystick bereit');
