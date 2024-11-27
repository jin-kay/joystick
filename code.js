/*Dieser Code implementiert den Eintritt und den Austritt aus dem komplexen Modus in den normalen Modus (langes Drücken der Taste, um sie nach links zu kippen, und Loslassen, um in den komplexen Modus einzutreten, und das Gleiche, um nach unten auszutreten). Migrieren Sie die Funktion des Stillhaltens der Maus bei schnellen Bewegungen in den komplexen Modus*/
// Setzt die Geschwindigkeitsschwelle für die Gestenerkennung und die Dauer der Geste
var GESTURE_DETECTION_SPEED = 15; // Geschwindigkeitsschwelle für die Gestenerkennung
var GESTURE_DURATION = 20; // Dauer der Geste (Einheit: Erkennungszyklen)
var USE_BLE = 1; // Steuerung, ob Bluetooth-Funktion verwendet wird (1 bedeutet aktiviert)
var on = true; // Initialzustand des Joysticks auf aktiviert setzen
var complexMode = false; // Komplexer Modus ist anfangs deaktiviert
var oldX = 0; // Speichert den vorherigen Wert der X-Richtung
var oldY = 0; // Speichert den vorherigen Wert der Y-Richtung
var deltaX = 0; // Änderung der X-Richtung

// Wenn Bluetooth verwendet wird, initialisiere den Bluetooth-HID-Dienst
if (USE_BLE == 1) {
  var int = require("ble_hid_combo");
  NRF.setServices(undefined, { hid: int.report }); // Bluetooth-HID-Dienst einrichten
}

// Definiere Basisempfindlichkeit, minimale Geschwindigkeit und maximale Geschwindigkeit
const baseSensitivity = 3000; // Basisempfindlichkeit, um den Neigungsgrad zu berechnen
const minSpeed = 0.01; // Mindestgeschwindigkeit bei geringer Neigung
const maxSpeed = 35; // Höchstgeschwindigkeit bei großer Neigung
const sensitivity = 1000; // Empfindlichkeitsschwelle für die Erkennung des Ruhezustands (um festzustellen, ob nahe der Ausgangsposition)

let detect = 0; // Zähler für die Gestenerkennung

// Funktion zur Verarbeitung von Beschleunigungssensordaten
function onAccel(a) {
  // Wenn der Button gedrückt wird, Neigungsrichtung bestimmen und entscheiden, ob komplexer Modus aktiviert wird
  if (digitalRead(BTN) === 1) {
    LED3.write(true); // LED3 leuchtet, wenn der Button gedrückt wird

    // Bestimme die Neigungsrichtung
    if (a.acc.x < sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      complexMode = true; // Nach links neigen, um in den komplexen Modus zu wechseln
    } else if (a.acc.y < sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      complexMode = false; // Nach unten neigen, um den komplexen Modus zu verlassen
    }
    return;
  } else {
    LED3.write(false); // LED3 ausschalten, wenn der Button losgelassen wird
  }
  let x = 0, y = 0;

  // Überprüfe, ob der Joystick nahe an der aufrechten Position ist (Logik zur Rückkehr zur Ausgangsposition)
  if (Math.abs(a.acc.x) < sensitivity && Math.abs(a.acc.y) < sensitivity) {
    // Wenn der Joystick nahe an der aufrechten Position ist, Mausbewegung stoppen
    x = 0;
    y = 0;
  } else {
    // Bestimme den Neigungsgrad
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);

    // Berechne die dynamische Geschwindigkeit basierend auf dem Neigungsgrad
    const dynamicSpeedX = tiltX < baseSensitivity
      ? minSpeed + (tiltX / baseSensitivity) * (tiltX / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    const dynamicSpeedY = tiltY < baseSensitivity
      ? minSpeed + (tiltY / baseSensitivity) * (tiltY / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    // Setze die Geschwindigkeit basierend auf der Richtung der Beschleunigung
    if (a.acc.y > 0) y = dynamicSpeedY; // Nach vorne neigen
    else if (a.acc.y < 0) y = -dynamicSpeedY; // Nach hinten neigen
    if (a.acc.x > 0) x = -dynamicSpeedX; // Nach links neigen
    else if (a.acc.x < 0) x = dynamicSpeedX; // Nach rechts neigen
  }

  // Berechne die Änderung der X-Richtung für die Gestenerkennung
  deltaX = Math.abs(x - oldX); // Änderung der X-Richtung berechnen
  const deltaY = Math.abs(y - oldY); // Änderung der Y-Richtung berechnen
  oldX = x; // Alten X-Wert aktualisieren
  oldY = y; // Alten Y-Wert aktualisieren

  // Im komplexen Modus, wenn die Änderungsgeschwindigkeit die Geschwindigkeitsschwelle überschreitet, Gestenerkennung auslösen
  if (complexMode && (deltaX > GESTURE_DETECTION_SPEED || deltaY > GESTURE_DETECTION_SPEED)) {
    detect = GESTURE_DURATION; // Setze die Dauer der Gestenerkennung
    LED3.write(true); // LED3 leuchtet, um anzuzeigen, dass eine Geste erkannt wurde
  }
  // Logik für den Gestenerkennungs-Timer
  if (detect > 0) {
    detect = detect - 1; // Zähler bei jedem Aufruf verringern
    if (detect == 0) {
      LED3.write(false); // Timer beendet, LED3 ausschalten
    }
  }

  // Wenn der Joystick aktiviert ist und eine Neigung oder Gestenerkennung aktiv ist, den aktuellen Status ausgeben
  if (on === true) {
    if ((x != oldX) || (y != oldY) || (detect != 0)) {
      console.log("", Math.floor(x), ",", Math.floor(y), ",", detect); // Aktuelle X-, Y- und Gestenzustände ausgeben
    }
    oldX = x;
    oldY = y;
  }

  // Wenn der Joystick aktiviert ist und die Bluetooth-HID-Funktion aktiviert ist, sende Mausbewegungsdaten
  if ((on === true) && (USE_BLE == 1)) {
    try {
      // Wenn keine Geste aktiv ist, Mausbewegungsdaten senden
      if (((x != 0) || (y != 0)) && (detect == 0)) {
        int.moveMouse(x, y); // Maus bewegen
      }
    } catch (error) {
      console.log("Fehler beim Senden des HID-Berichts:", error); // Fehler beim Senden des HID-Berichts abfangen und ausgeben
    }
  }
}

// Beschleunigungssensor aktivieren, Frequenz auf 26Hz setzen (niedrigere Frequenz reduziert den Energieverbrauch)
Puck.accelOn(26);

// Auf Beschleunigungssensordaten hören, onAccel Verarbeitungsfunktion aufrufen
Puck.on('accel', onAccel);

// Bluetooth-Werbung aktivieren, um die Geräteerkennung und Verbindung zu ermöglichen
if (USE_BLE == 1) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" }); // Bluetooth-Gerätenamen einstellen
}

console.log('BLEJoystick bereit (nur Bluetooth)'); // Ausgabe, um anzuzeigen, dass das Programm bereit ist (nur Bluetooth)
