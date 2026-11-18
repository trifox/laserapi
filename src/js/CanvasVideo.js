// laser-chris-start:
//  ok also das hat gemini gezaubert, damit haben wir weissabgleich kontrolle, belichtungszeit, 
// mega, es ergibt sich fast das man die laser als starke lichtquelle solo isolieren koennte
// aktuell spiele ich noch mit den faktoren rum, aber es ergibt sich das maximal contrast und sättigung 
// mit null helligkeit das settings ist das ist aktuell christians denke, waer eigentlich supergut 
// wenn die laser nur durch helligkeit identifiziert wuerden, durch niedrige belichtung weil sie halt sooo hell sind
// aber erst mal das setup ausprobieren und finetunen
// laser-chris-end!
// Den Konfigurations-Handler für die Laser-API laden
var laserConfig = require("./LaserApiConfig.js").default;
var video = null;
var currentStream = null; // Speichert den aktiven MediaStream, um ihn später sauber zu stoppen

// ==========================================
// KAMERA-EINSTELLUNGEN FÜR LASER-TRACKING
// ==========================================
const CAMERA_SETTINGS = {
  // Belichtungszeit: Kleinere Werte = dunkleres Bild, verhindert Schlieren (Motion Blur) bei schnellen Lasern.
  // Einheit meist in 100 Mikrosekunden (50 = 5ms).
  exposureTime: 40,
  
  // Weißabgleich komplett ausschalten? (true = none, verhindert automatisches "Pumpen" der Helligkeit/Farben)
  disableWhiteBalance: true,
  
  // Fallback-Farbtemperatur in Kelvin (falls 'none' von der Hardware nicht unterstützt wird)
  colorTemperature: 4000,
};

/**
 * Interne Hilfsfunktion zum Starten oder Neustarten des Kamera-Streams
 * @param {HTMLVideoElement} videoElement - Das Video-DOM-Element
 */
function startCamera(videoElement) {
  // Alten Stream stoppen, falls bereits einer aktiv war (wichtig für reinit / Ressourcenfreigabe)
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  console.log("Initialising VIDEO from canvas DOM element", videoElement);

  // Zugriff auf Mediengeräte (Webcam) anfordern
  navigator.mediaDevices
    .getUserMedia({
      video: {
        width: laserConfig.videoResolution.width,
        height: laserConfig.videoResolution.height,
      },
    })
    .then(async function (stream) {
      currentStream = stream;
      console.log("Stream received", stream);
      
      // Stream an das Video-Element binden
      videoElement.srcObject = stream;

        // Den ersten Videotrack für Kamera-Steuerung (Constraints) holen
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      console.log("Camera capabilities:", capabilities);

      const constraints = {};

      // 1. Manuelle Belichtungszeit anwenden (falls von der Kamera unterstützt)
      if (capabilities.exposureMode && capabilities.exposureMode.includes("manual")) {
        constraints.exposureMode = "manual";
        if (capabilities.exposureTime) {
          constraints.exposureTime = Math.max(
            capabilities.exposureTime.min, 
            Math.min(CAMERA_SETTINGS.exposureTime, capabilities.exposureTime.max)
          );
        }
      } 
      // Fallback: Belichtungskorrektur nach unten drehen (EV), falls manual nicht geht
      else if (capabilities.exposureCompensation) {
        constraints.exposureCompensation = capabilities.exposureCompensation.min;
      }

      // 2. Weißabgleich ausschalten oder manuell fixieren
      if (capabilities.whiteBalanceMode) {
        if (CAMERA_SETTINGS.disableWhiteBalance && capabilities.whiteBalanceMode.includes("none")) {
          // Komplett deaktivieren, damit die Farben starr bleiben
          constraints.whiteBalanceMode = "none";
        } else if (capabilities.whiteBalanceMode.includes("manual")) {
          // Fallback auf manuell mit fester Farbtemperatur
          constraints.whiteBalanceMode = "manual";
          if (capabilities.colorTemperature) {
            constraints.colorTemperature = Math.min(
              Math.max(CAMERA_SETTINGS.colorTemperature, capabilities.colorTemperature.min),
              capabilities.colorTemperature.max
            );
          }
        }
      }

      // Wenn Constraints ermittelt wurden, diese auf den Videotrack anwenden
      if (Object.keys(constraints).length > 0) {
        try {
          await track.applyConstraints({ advanced: [constraints] });
          console.log("Applied camera constraints:", constraints);
        } catch (err) {
          console.warn("Konnte Kamera-Settings nicht anpassen:", err);
        }
      }

      // Sobald die Metadaten geladen sind, die Wiedergabe starten
      videoElement.onloadedmetadata = function () {
        videoElement.play();
      };
    })
    .catch(function (err) {
      console.error("Camera init failed:", err);
    });
}

// Exportiertes Modul für die Video-Steuerung
export default {
  // Gibt das aktuelle Video-Element zurück
  getVideo: function () {
    return video;
  },
  
  // Initiale Einrichtung der Kamera beim Spielstart
  init: function (videoIn) {
    video = videoIn;
    startCamera(video);
  },
  
  // Re-Init Methode für die GUI: Stoppt den alten Stream und startet die Kamera neu (z.B. bei Einstellungsänderungen)
  reinit: function () {
    if (video) {
      console.log("Re-initializing video stream via GUI command...");
      startCamera(video);
    } else {
      console.warn("Cannot reinit video: video element is not initialized yet.");
    }
  },
};