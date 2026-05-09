#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <math.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define MPU_ADDR 0x68
#define BUTTON_PIN 4

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// 🔹 WiFi
const char* ssid = "Hash";
const char* password = "hashirkhan";

// 🔹 Backend (UPDATE THIS IF IP CHANGES)
const char* serverUrl = "http://192.168.132.114:8000/alert";

// 🔹 GPS
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

float latitude = 0.0;
float longitude = 0.0;

// 🔹 MPU
int16_t ax, ay, az;

// 🔹 Thresholds
float FREE_FALL_THRESHOLD = 0.85;
float IMPACT_THRESHOLD = 1.7;

// 🔹 Fall logic
bool freeFallDetected = false;
unsigned long freeFallTime = 0;

// 🔹 Timers
unsigned long lastUpdate = 0;
unsigned long interval = 300000;

unsigned long lastMPURead = 0;
int mpuInterval = 50;

// 🔹 Send data (FIXED)
void sendData(String type) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    return;
  }

  float lat = gps.location.isValid() ? latitude : 0.0;
  float lon = gps.location.isValid() ? longitude : 0.0;

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"device_id\":\"SOS_01\",\"trigger_type\":\"" + type +
                "\",\"latitude\":" + String(lat,6) +
                ",\"longitude\":" + String(lon,6) +
                ",\"comm_mode\":\"wifi\"}";

  Serial.println("🚀 SENDING: " + type);

  int response = http.POST(json);

  Serial.print("Response: ");
  Serial.println(response);

  http.end();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found ❌");
    while (1);
  }

  display.setTextSize(1);
  display.setTextColor(WHITE);

  // MPU
  Wire.beginTransmission(MPU_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("MPU NOT FOUND ❌");
    while (1);
  }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  Serial.println("MPU Ready ✅");

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected ✅");

  // GPS
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("GPS Started");

  // Button
  pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {

  // 🔹 GPS READ
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  if (gps.location.isUpdated()) {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
  }

  // 🔘 BUTTON (FIXED SIMPLE LOGIC)
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("🚨 SOS BUTTON PRESSED");
    sendData("SOS");
    delay(300); // debounce
  }

  // 🔹 MPU READ
  if (millis() - lastMPURead >= mpuInterval) {
    lastMPURead = millis();

    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    Wire.endTransmission(false);

    if (Wire.requestFrom(MPU_ADDR, 6, true) == 6) {

      ax = Wire.read() << 8 | Wire.read();
      ay = Wire.read() << 8 | Wire.read();
      az = Wire.read() << 8 | Wire.read();

      float ax_g = ax / 16384.0;
      float ay_g = ay / 16384.0;
      float az_g = az / 16384.0;

      float totalAcc = sqrt(ax_g * ax_g + ay_g * ay_g + az_g * az_g);

      Serial.print("G: ");
      Serial.println(totalAcc);

      // FREE FALL
      if (totalAcc < FREE_FALL_THRESHOLD && totalAcc > 0.2) {
        freeFallDetected = true;
        freeFallTime = millis();
        Serial.println("FREE FALL DETECTED");
      }

      // IMPACT
      else if (totalAcc > IMPACT_THRESHOLD) {
        Serial.println("IMPACT DETECTED");

        if (freeFallDetected && millis() - freeFallTime < 2000) {
          Serial.println("🚨 FALL CONFIRMED");
          sendData("fall_detected");
        }

        freeFallDetected = false;
      }

      // OLED
      display.clearDisplay();

      display.setCursor(0, 0);
      display.print("G:");
      display.println(totalAcc, 2);

      display.setCursor(0, 10);
      display.print("Sat:");
      display.println(gps.satellites.value());

      display.setCursor(0, 20);
      display.println(gps.location.isValid() ? "GPS OK" : "NO GPS");

      display.display();
    }
  }

  // 📍 Location update every 5 min
  if (millis() - lastUpdate > interval) {
    sendData("location_update");
    lastUpdate = millis();
  }

  delay(50);
}
