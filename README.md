# Multi-Trigger SOS Emergency System

**An embedded IoT system for real-time emergency detection and alert delivery with dual-channel communication and GPS-based location reporting.**

---

## Overview

Falls and medical emergencies frequently occur in situations where the affected individual is unable to manually call for help. Existing consumer solutions are often proprietary, cloud-locked, or lack offline reliability. This project addresses that gap by building a self-contained emergency alert system using an ESP32 microcontroller that detects emergencies through both sensor data and manual input, acquires GPS location, and dispatches alerts through the most available communication channel.

The system uses an MPU6050 IMU sensor to detect free-fall and impact events, identifying falls without user interaction. A manual push button provides a secondary trigger for conscious users. On detection, the system collates GPS coordinates and attempts to deliver an alert via WiFi. If WiFi is unavailable, a SIM800L GSM module takes over and sends an SMS. Simultaneously, the system logs the event to a Supabase cloud database and sends an instant notification through a Telegram bot.

The result is a layered, fault-tolerant alert pipeline designed to function in both connected and disconnected environments.

---

## System Architecture

The ESP32 serves as the central processing unit, interfacing with all sensors and communication modules. On startup, it initializes all peripherals and begins monitoring two trigger conditions: an interrupt-driven fall detection pipeline from the MPU6050, and a debounced digital read from a push button.

When either trigger activates, the firmware constructs an alert payload containing a timestamp, trigger type, and GPS coordinates retrieved from the NEO-6M module over UART. The system then evaluates WiFi connectivity.

If a WiFi connection is active, the ESP32 makes an HTTPS POST request to a Supabase REST endpoint to log the event, and independently calls the Telegram Bot API to dispatch a formatted alert message containing the GPS location as a Google Maps link. Both operations occur in the same alert cycle.

If WiFi is not available, the firmware falls back to the SIM800L GSM module, issuing AT commands over a dedicated UART channel to send an SMS with the alert text and GPS coordinates to a preconfigured emergency contact number.

An SSD1306 OLED display shows real-time system state throughout the process. It is intended for development and demonstration purposes, not end-user interaction.

```
[MPU6050 / Push Button] --> [ESP32]
                                |
                    [GPS module - NEO-6M]
                                |
                  +-------------+-------------+
                  |                           |
            [WiFi available]           [WiFi unavailable]
                  |                           |
       +----------+----------+         [SIM800L GSM]
       |                     |               |
 [Supabase DB]        [Telegram Bot]     [SMS Alert]
```

---

## Features

- Automatic fall detection using free-fall and impact threshold logic on the MPU6050
- Manual SOS trigger via a hardware push button
- Real-time GPS location acquisition using the NEO-6M module
- Alert delivery via Telegram bot with a formatted GPS link
- Event logging to Supabase cloud database over HTTPS
- GSM-based SMS fallback when WiFi is unavailable, using the SIM800L module
- OLED status display for debugging and live state monitoring
- Dual-power architecture to isolate high-current GSM operation from the main logic circuit
- Modular firmware structure allowing independent testing of each subsystem

---

## Hardware Components

| Component | Purpose |
|---|---|
| ESP32 (WROOM / DevKit) | Main microcontroller; runs all logic, WiFi, and UART communication |
| MPU6050 | 6-axis IMU; provides accelerometer and gyroscope data for fall detection |
| NEO-6M GPS module | Acquires latitude, longitude, and satellite time via NMEA over UART |
| SSD1306 OLED (128x64) | Displays system state, alert status, and debug information |
| SIM800L GSM module | Sends SMS alerts over the cellular network when WiFi is unavailable |
| Push button | Hardware input for manual SOS triggering |
| Buzzer | Audible confirmation of alert dispatch |
| LiPo battery (main) | Powers the ESP32, sensors, display, and GPS |
| LiPo battery (GSM) | Dedicated power supply for the SIM800L |
| Boost converter | Steps up LiPo voltage to 4.0–4.2 V for stable SIM800L operation |

---

## Communication Design

### I2C
The MPU6050 and SSD1306 OLED both communicate over I2C. The MPU6050 uses the default I2C address (0x68), and the OLED uses 0x3C. Both share the same SDA and SCL lines on the ESP32.

### UART
Two separate UART channels are used:
- **UART1**: NEO-6M GPS module, configured at 9600 baud. NMEA sentences are parsed using a lightweight library (TinyGPS++ or equivalent).
- **UART2**: SIM800L GSM module, configured at 9600 baud. Communication is via standard Hayes AT commands for network registration, SMS formatting, and send operations.

### WiFi / HTTP
The ESP32's built-in 802.11 b/g/n radio handles WiFi connectivity. Alert data is sent as a JSON payload over HTTPS to the Supabase REST API using the `HTTPClient` library. A separate HTTPS GET request is made to the Telegram Bot API endpoint to post the alert message.

### Telegram Bot API
The Telegram bot is configured via BotFather. On alert, the firmware sends an HTTP GET request to `api.telegram.org/bot<TOKEN>/sendMessage` with the chat ID of the recipient and a message body containing trigger type and a Google Maps link derived from GPS coordinates.

### GSM Fallback
When WiFi association fails or times out, the system sends AT commands to the SIM800L to compose and dispatch an SMS. The SIM800L is polled for network registration status before attempting to send. If registration fails within a timeout window, the system logs the failure and retriggers the buzzer.

---

## Working Principle

1. **Initialization**: On power-up, the ESP32 initializes I2C, UART1, UART2, WiFi, and all peripherals. The OLED displays a startup sequence and system status.

2. **Monitoring loop**: The firmware continuously polls the MPU6050 for acceleration data and monitors the push button state. The MPU6050 interrupt pin is also configured to fire on free-fall detection as an additional fast-path trigger.

3. **Fall detection**: A two-stage detection algorithm checks for a free-fall event (low G-force over a threshold duration) followed by an impact event (high G-force spike). Both conditions must occur in sequence within a configurable time window to trigger an alert, reducing false positives.

4. **Manual trigger**: The push button is read with software debouncing. A sustained press beyond a defined duration (e.g., 2 seconds) activates the alert to prevent accidental triggering.

5. **GPS acquisition**: On alert trigger, the firmware requests a fresh GPS fix from the NEO-6M module. If a valid fix is available within a timeout, coordinates are included in the alert payload. If not, a fallback message notes that location is unavailable.

6. **Alert dispatch - WiFi path**: The ESP32 connects to the configured WiFi network, constructs the Supabase JSON payload, and sends the HTTPS POST. It then sends the Telegram message. Both operations are performed sequentially.

7. **Alert dispatch - GSM path**: If WiFi connection fails or times out, the firmware switches to UART2, verifies SIM800L registration on the GSM network, and sends an SMS using `AT+CMGS`.

8. **Confirmation**: The buzzer emits a confirmation pattern on successful alert dispatch. The OLED displays the alert status and the communication channel used.

9. **Reset**: After a configurable cooldown period, the system returns to the monitoring state.

---

## Power Design Considerations

The SIM800L GSM module is the most power-demanding component in the system, drawing peak currents of up to 2 A during GPRS burst transmission and approximately 500 mA during active call/SMS operations. Supplying this from a shared rail with the ESP32 and sensors risks voltage dips that can cause the ESP32 to brown out or reset mid-alert, which would interrupt the fallback mechanism at a critical moment.

To address this, the SIM800L is powered from a dedicated LiPo cell through a boost converter that maintains a stable 4.0–4.2 V supply. This isolates GSM transients from the main logic rail, which runs the ESP32, MPU6050, GPS, OLED, and buzzer from a separate LiPo.

Key considerations:
- Decoupling capacitors (470 uF or larger) are placed close to the SIM800L VBAT pin to absorb inrush current during transmission bursts.
- The ESP32 operates at 3.3 V. Level shifting or voltage dividers are used where SIM800L TX/RX lines interface with ESP32 GPIO.
- The NEO-6M GPS module is powered from the 3.3 V regulated output of the ESP32 or a dedicated LDO, as it is sensitive to supply noise.
- Battery selection should account for the continuous monitoring use case. A 2000–3000 mAh LiPo for the main rail and a 1000–2000 mAh cell for GSM are reasonable starting points depending on deployment duration.

---

## Setup Instructions

### Prerequisites

- Arduino IDE 2.x or PlatformIO (VS Code)
- ESP32 board support package installed
- Required libraries:
  - `TinyGPS++`
  - `Adafruit SSD1306`
  - `Adafruit MPU6050`
  - `ArduinoJson`
  - `HTTPClient` (included with ESP32 core)

### Configuration

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/sos-emergency-system.git
   cd sos-emergency-system
   ```

2. Open `config.h` and fill in your credentials:
   ```cpp
   #define WIFI_SSID        "your_wifi_ssid"
   #define WIFI_PASSWORD    "your_wifi_password"
   #define SUPABASE_URL     "https://<project>.supabase.co/rest/v1/alerts"
   #define SUPABASE_KEY     "your_supabase_anon_key"
   #define TELEGRAM_TOKEN   "your_telegram_bot_token"
   #define TELEGRAM_CHAT_ID "your_chat_id"
   #define EMERGENCY_PHONE  "+91XXXXXXXXXX"
   ```

3. Flash the firmware:
   - Select the correct ESP32 board and COM port in the IDE.
   - Upload `main.ino` (or the PlatformIO equivalent).

4. Set up Supabase:
   - Create a table named `alerts` with columns: `id`, `timestamp`, `trigger_type`, `latitude`, `longitude`, `comm_channel`.
   - Enable Row Level Security policies as appropriate for your use case.

5. Set up the Telegram bot:
   - Create a bot via BotFather and obtain the token.
   - Send a message to the bot and retrieve your `chat_id` via the getUpdates API.

6. Verify hardware connections per the wiring diagram in `/docs/wiring.md`.

---

## Folder Structure

```
sos-emergency-system/
├── src/
│   ├── main.ino               # Main firmware entry point
│   ├── config.h               # WiFi, API keys, and thresholds
│   ├── fall_detection.cpp     # MPU6050 fall and impact logic
│   ├── gps_handler.cpp        # NEO-6M NMEA parsing
│   ├── alert_dispatcher.cpp   # WiFi, Telegram, Supabase, GSM logic
│   ├── gsm_handler.cpp        # SIM800L AT command interface
│   └── display_handler.cpp    # OLED state rendering
├── docs/
│   ├── wiring.md              # Pin mapping and wiring diagram
│   ├── architecture.md        # Extended system design notes
│   └── images/                # Hardware photos, block diagrams
├── test/
│   └── unit_tests/            # Component-level test sketches
├── README.md
└── LICENSE
```

---

## Future Improvements

- **Battery monitoring**: Integrate a voltage divider or fuel gauge IC to include battery level in alert payloads and warn before power loss.
- **Offline alert queuing**: Store failed alert attempts in SPIFFS or EEPROM and retry delivery when connectivity is restored.
- **BLE configuration**: Add a Bluetooth Low Energy interface to allow field configuration of WiFi credentials and contact numbers without reflashing.
- **Adaptive fall thresholds**: Implement a calibration routine that learns baseline movement patterns and adjusts detection thresholds per user.
- **Two-way acknowledgment**: Extend the Telegram integration to allow the responder to acknowledge receipt, triggering a different buzzer pattern on the device to confirm the alert was received.
- **LoRa integration**: Add a LoRa module as a third communication tier for remote deployments beyond cellular coverage.
- **Enclosure design**: Design a compact 3D-printed enclosure with a wearable form factor suited to the target use case.

---

## Use Cases

- **Elderly care**: Wearable device for older adults living independently, providing automatic fall detection and one-touch emergency access.
- **Industrial safety**: Monitoring workers in high-risk environments such as construction sites, warehouses, or remote fieldwork locations.
- **Solo trekking and remote activity**: Provides GPS-linked SOS capability in areas with intermittent connectivity, using GSM as a fallback.
- **Post-surgical or at-risk patient monitoring**: Home-based deployment for individuals with a documented fall risk during recovery.
- **Disaster response prototyping**: Base architecture for low-cost emergency communication nodes where infrastructure may be compromised.

---

## License

This project is released under the MIT License. See `LICENSE` for details.
