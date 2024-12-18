// Importieren des Moduls ble_hid_combo für HID-Funktionen
var int = require("ble_hid_combo");

// Initialisieren des Bluetooth-HID-Dienstes im Kombinationsmodus
NRF.setServices(undefined, { hid: int.report });

// Konfiguration der Schwellenwerte und Dauer für die Gestenerkennung
var GESTURE_DETECTION_SPEED = 15; // Geschwindigkeitsschwelle für Gestenerkennung
var GESTURE_DURATION = 20;        // Dauer der Gestenerkennung
var USE_BLE = 1;                  // Bluetooth-Flag aktivieren
var on = true;                    // Aktivieren der Mausbewegung
var complexMode = false;          // Flag für den Komplexmodus
var cursorMode = false;           // Flag für den Cursor-Modus
var oldX = 0, oldY = 0;           // Vorherige Beschleunigungswerte
var deltaX = 0;                   // Änderung in der X-Richtung zur Gestenerkennung

// Flags zur Steuerung von Einzel- und Mehrfachklicks
var sendonekeypress = true;       // Flag für Einzelklick
var sendmultykeypress = false;    // Flag für Mehrfachklick
var tiltStartTime = 0;            // Zeitstempel des Neigungsbeginns
var multiPressIntervalId = null;  // Speichern der Referenz für setInterval

// Festlegen der Auslösedauer und des Intervalls für Mehrfachklicks
const MULTI_KEYPRESS_DELAY = 1000;   // Auslösedauer für Mehrfachklicks (1 Sekunde)
const MULTI_KEYPRESS_INTERVAL = 500; // Intervall für Mehrfachklicks (500 Millisekunden)

// Festlegen der Empfindlichkeit und Geschwindigkeitskonfiguration
const baseSensitivity = 3000;        // Basissensitivität für dynamische Geschwindigkeitsberechnung
const minSpeed = 0.01;               // Minimale Mausgeschwindigkeit
const maxSpeed = 40;                 // Maximale Mausgeschwindigkeit
const sensitivity = 1000;            // Schwelle für Moduswechsel

let detect = 0; // Abkühlzähler für Gestenerkennung

// Simulieren eines Tastendrucks und Festlegen der Verzögerung für das Loslassen
function sendKeyPress(keyCode) {
  try {
    int.tapKey(keyCode);               // Simulieren eines Tastendrucks
    setTimeout(() => int.tapKey(0), 50); // Loslassen der Taste nach 50 Millisekunden
  } catch (error) {
    console.log("Key press error:", error);
  }
}

// Senden von Mausbewegungsdaten
function moveMouse(dx, dy) {
  try {
    int.moveMouse(dx, dy);            // Bewegen der Maus um die angegebene Distanz
  } catch (error) {
    console.log("Mouse move error:", error);
  }
}

// Zurücksetzen von Modus und Beschleunigungswerten
function resetModes() {
  complexMode = false;                // Deaktivieren des Komplexmodus
  cursorMode = false;                 // Deaktivieren des Cursor-Modus
  oldX = 0;                           // Zurücksetzen des X-Beschleunigungswerts
  oldY = 0;                           // Zurücksetzen des Y-Beschleunigungswerts
}

// Hauptlogik für die Verarbeitung von Beschleunigungsmessereignissen
function onAccel(a) {
  const isUpright = Math.abs(a.acc.x) < sensitivity && Math.abs(a.acc.y) < sensitivity;

  // Überprüfen, ob die Taste gedrückt wurde, um den Modus zu wechseln
  if (digitalRead(BTN) === 1) {
    LED3.write(true); // Anzeigen des Moduswechsels

    // Wechsel in den Komplexmodus bei linker Neigung
    if (a.acc.x < -sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      complexMode = true;
      cursorMode = false;
      console.log("Switched to Complex Mode");
    }
    // Wechsel in den Cursor-Modus bei rechter Neigung
    else if (a.acc.x > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      cursorMode = true;
      complexMode = false;
      console.log("Switched to Cursor Mode");
    }
    // Wechsel in den Normalmodus bei nach unten gerichteter Neigung
    else if (a.acc.y < sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      resetModes();
      console.log("Switched to Normal Mode");
    }
    return; // Beenden der Verarbeitung nach Moduswechsel
  } else {
    LED3.write(false); // Ausschalten der Moduswechselanzeige
  }

  // **Logik für den Cursor-Modus**
  if (cursorMode && !complexMode && detect == 0) {
    if (isUpright) {
      tiltStartTime = 0; // Zurücksetzen des Neigungsbeginns
      sendonekeypress = true;

      if (multiPressIntervalId) {
        clearInterval(multiPressIntervalId);
        multiPressIntervalId = null;
        sendmultykeypress = false;
        console.log("Multi-key press stopped");
      }
    } else {
      if (tiltStartTime === 0) tiltStartTime = Date.now();
      const tiltDuration = Date.now() - tiltStartTime;

      if (tiltDuration < MULTI_KEYPRESS_DELAY && sendonekeypress) {
        console.log("Single key press triggered");
        if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT);
        else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN);
        sendonekeypress = false;
      } else if (tiltDuration >= MULTI_KEYPRESS_DELAY && !sendmultykeypress) {
        console.log("Multi-key press started");
        sendmultykeypress = true;
        multiPressIntervalId = setInterval(() => {
          if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT);
          else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN);
          console.log("Multi-key press triggered");
        }, MULTI_KEYPRESS_INTERVAL);
      }
    }
    return; // Rückgabe, um andere Logik zu überspringen
  }

  // **Logik für Komplex- und Normalmodus**
  let x = 0, y = 0;
  if (isUpright) {
    x = 0; y = 0; // Anhalten der Mausbewegung bei Aufrichtung
  } else {
    // Dynamische Geschwindigkeitsanpassung basierend auf der Neigung
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);

    const dynamicSpeedX = tiltX < baseSensitivity
      ? minSpeed + (tiltX / baseSensitivity) ** 3 * (maxSpeed - minSpeed)
      : maxSpeed;

    const dynamicSpeedY = tiltY < baseSensitivity
      ? minSpeed + (tiltY / baseSensitivity) ** 3 * (maxSpeed - minSpeed)
      : maxSpeed;

    x = a.acc.x > 0 ? -dynamicSpeedX : dynamicSpeedX;
    y = a.acc.y < 0 ? -dynamicSpeedY : dynamicSpeedY;
  }

  // Handhabung der Gestenerkennung im Komplexmodus
  deltaX = Math.abs(x - oldX);        // Berechnung der Änderung in X-Richtung
  const deltaY = Math.abs(y - oldY); // Berechnung der Änderung in Y-Richtung
  oldX = x;                           // Aktualisieren des vorherigen X-Werts
  oldY = y;                           // Aktualisieren des vorherigen Y-Werts
 
  if (complexMode && (deltaX > GESTURE_DETECTION_SPEED || deltaY > GESTURE_DETECTION_SPEED)) {
    detect = GESTURE_DURATION; // Aktivieren der Abkühlzeit
    LED3.write(true);
  }

  // Abkühlzeit für Gestenerkennung
  if (detect > 0) {
    detect--;
    if (detect == 0) LED3.write(false);
  }

  // Senden von Mausbewegungen im Normal- oder Komplexmodus
  if (on && USE_BLE && detect == 0 && !cursorMode) {
    if (x !== 0 || y !== 0) moveMouse(x, y);
  }
}

// Aktivieren des Beschleunigungsmessers und Registrieren des Ereignis-Listeners
Puck.accelOn(26);                    // Aktivieren des Beschleunigungsmessers mit 26 Hz
Puck.on('accel', onAccel);           // Festlegen des Ereignis-Listeners für Beschleunigungsdaten

// Aktivieren der Bluetooth-Werbung und Festlegen des Gerätenamens
if (USE_BLE) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" });
}

console.log('BLE Joystick ready');
