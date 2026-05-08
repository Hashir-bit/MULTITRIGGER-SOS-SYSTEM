from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Add CORS middleware for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")

#  Define which triggers are REAL alerts
ALERT_TYPES = ["fall_detected", "SOS", "impact"]


#  Data model
class Alert(BaseModel):
    device_id: str
    trigger_type: str
    latitude: float
    longitude: float
    comm_mode: str


#  Root check
@app.get("/")
def root():
    return {"message": "Backend Running"}

# System check for frontend ping
@app.get("/data")
def check_status():
    return {"status": "success", "message": "System alive"}


#  Main endpoint
@app.post("/alert")
def send_alert(alert: Alert):

    data = alert.dict()

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    try:
        # 🔹 1. Store in Supabase
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/alerts",
            json=data,
            headers=headers
        )

        print("DB:", response.status_code, response.text)
        print("TYPE:", alert.trigger_type)

        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=500,
                detail=f"Supabase error: {response.text}"
            )

        # 🔹 2. Send Telegram ONLY for real alerts
        if alert.trigger_type in ALERT_TYPES:

            message = f"""
  SOS ALERT 
Device: {alert.device_id}
Type: {alert.trigger_type}
Location: https://maps.google.com/?q={alert.latitude},{alert.longitude}
Mode: {alert.comm_mode}
"""

            tg_response = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                json={
                    "chat_id": CHAT_ID,
                    "text": message
                }
            )

            print("TG:", tg_response.status_code, tg_response.text)

            return {
                "status": "success",
                "message": "Alert stored + Telegram sent"
            }

        # 🔹 3. For location updates (no Telegram)
        return {
            "status": "success",
            "message": "Location stored (no alert sent)"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))