
// Importiert das Modul ble_hid_combo
var int = require("ble_hid_combo");

// Initialisiert den Bluetooth-HID-Dienst im Kombinationsmodus
NRF.setServices(undefined, { hid: int.report });

// Legt die Geschwindigkeitsschwelle und Dauer für Gestenerkennung fest
var GESTURE_DETECTION_SPEED = 15;
var GESTURE_DURATION = 20;
var USE_BLE = 1;
var on = true;
var complexMode = false; // Flag für den komplexen Modus
var cursorMode = false; // Flag für den Cursor-Modus
var oldX = 0, oldY = 0; // Vorherige Beschleunigungswerte
var deltaX = 0; // Änderungsrate in X-Richtung für Gestenerkennung

// Definiert Basissensitivität, minimale und maximale Geschwindigkeit
const baseSensitivity = 3000;
const minSpeed = 0.01;
const maxSpeed = 35;
const sensitivity = 1000;

let detect = 0; // Zähler für Gestenerkennung

// Verbesserte Funktion zum Senden von Tastendruckereignissen
function sendKeyPress(keyCode) {
  try {
    int.tapKey(keyCode); // Nutzt die tapKey-Methode aus ble_hid_combo
    setTimeout(() => int.tapKey(0), 50); // Verzögerung für Tastenfreigabe
  } catch (error) {
    console.log("Fehler beim Senden eines Tastendrucks:", error);
  }
}

// Funktion zur Behandlung von Mausbewegungen
function moveMouse(dx, dy) {
  try {
    int.moveMouse(dx, dy); // Nutzt die moveMouse-Methode aus ble_hid_combo
  } catch (error) {
    console.log("Fehler bei der Mausbewegung:", error);
  }
}

// Setzt Modus- und Statusflags zurück
function resetModes() {
  complexMode = false;
  cursorMode = false;
  oldX = 0;
  oldY = 0;
}

// Hauptlogik zur Verarbeitung von Beschleunigungssensordaten
function onAccel(a) {
  // Logik zur Modusumschaltung bei gedrücktem Knopf
  if (digitalRead(BTN) === 1) {
    LED3.write(true);

    // Bestimmt Modusänderungen
    if (a.acc.x < sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      complexMode = true; // Neigung nach links aktiviert komplexen Modus
      cursorMode = false; // Cursor-Modus deaktivieren
      console.log("Komplexer Modus aktiviert");
    } else if (a.acc.x > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      cursorMode = true; // Neigung nach rechts aktiviert Cursor-Modus
      complexMode = false; // Komplexer Modus deaktivieren
      console.log("Cursor-Modus aktiviert");
    } else if (a.acc.y < sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      resetModes(); // Neigung nach unten deaktiviert alle Modi
      console.log("Normalmodus aktiviert");
    }
    return; // Moduswechsel abgeschlossen, Beenden
  } else {
    LED3.write(false);
  }

  // Logik für den Cursor-Modus
  if (cursorMode) {
    if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT); // Links-/Rechtstasten
    } else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN); // Oben-/Untentasten
    }
    return; // Im Cursor-Modus keine Mausbewegungen
  }

  // Initialisiert Mausbewegungsvariablen
  let x = 0, y = 0;

  // Prüft auf annähernd aufrechte Position (Normal- und komplexer Modus)
  if (Math.abs(a.acc.x) < sensitivity && Math.abs(a.acc.y) < sensitivity) {
    x = 0;
    y = 0;
  } else {
    // Berechnet Neigungsgrad und passt Geschwindigkeit dynamisch an
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);

    const dynamicSpeedX = tiltX < baseSensitivity
      ? minSpeed + (tiltX / baseSensitivity) * (tiltX / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    const dynamicSpeedY = tiltY < baseSensitivity
      ? minSpeed + (tiltY / baseSensitivity) * (tiltY / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    // Korrigiert Bewegungsrichtung für konsistente Steuerung
    x = a.acc.x > 0 ? -dynamicSpeedX : dynamicSpeedX; // X-Richtung invertiert
    y = a.acc.y < 0 ? -dynamicSpeedY : dynamicSpeedY; // Y-Richtung beibehalten
  }

  // Logik für Gestenerkennung
  deltaX = Math.abs(x - oldX);
  const deltaY = Math.abs(y - oldY);
  oldX = x;
  oldY = y;

  if (complexMode && (deltaX > GESTURE_DETECTION_SPEED || deltaY > GESTURE_DETECTION_SPEED)) {
    detect = GESTURE_DURATION; // Aktiviert Gestenerkennung
    LED3.write(true);
  }

  if (detect > 0) {
    detect--;
    if (detect == 0) LED3.write(false);
  }

  // Senden von Mausbewegungen im Normal- oder komplexen Modus
  if (on && USE_BLE && detect == 0) {
    if (x !== 0 || y !== 0) moveMouse(x, y);
  }
}

// Aktiviert Beschleunigungssensor und überwacht Ereignisse
Puck.accelOn(26);
Puck.on('accel', onAccel);

// Aktiviert Bluetooth-Werbung
if (USE_BLE) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" });
}

console.log('BLEJoystick bereit im erweiterten Modus');
