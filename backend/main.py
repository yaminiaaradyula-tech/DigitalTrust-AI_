
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from difflib import SequenceMatcher
import sqlite3
import json
import re
from pathlib import Path

app = FastAPI(
    title="BrandShield AI",
    description="Digital Risk Protection: Social and App Monitoring",
    version="1.0.0"
)

# React/Vite frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).with_name("brandshield.db")


def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                website TEXT DEFAULT '',
                logo_url TEXT DEFAULT '',
                social_urls TEXT DEFAULT '[]',
                official_apps TEXT DEFAULT '[]'
            )
        """)

        count = db.execute(
            "SELECT COUNT(*) FROM brands"
        ).fetchone()[0]

        if count == 0:
            db.execute("""
                INSERT INTO brands
                (name, website, logo_url, social_urls, official_apps)
                VALUES (?, ?, ?, ?, ?)
            """, (
                "NovaPay",
                "https://example.com",
                "",
                json.dumps(["https://social.example.com/novapay"]),
                json.dumps([{
                    "name": "NovaPay Official",
                    "publisher": "NovaPay Technologies"
                }])
            ))


init_db()


# ---------------------------
# Request models
# ---------------------------

class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    website: str = ""
    logo_url: str = ""
    social_urls: list[str] = []
    official_apps: list[dict] = []


class SocialProfileCreate(BaseModel):
    brand: str
    profile_name: str
    platform: str = "Other"
    url: str = ""
    followers: int = 0
    verified_official: bool = False


class AppCreate(BaseModel):
    brand: str
    app_name: str
    publisher: str = "Unknown"
    store: str = "Other"
    official: bool = False


# ---------------------------
# Demo data
# Clearly labelled as simulated.
# ---------------------------

social_profiles = [
    {
        "id": 1,
        "brand": "NovaPay",
        "profile_name": "NovaPay Official",
        "platform": "Instagram",
        "url": "https://demo.example.com/novapay",
        "followers": 12000,
        "verified_official": True,
    },
    {
        "id": 2,
        "brand": "NovaPay",
        "profile_name": "NovaPay Support Help",
        "platform": "Instagram",
        "url": "https://demo.example.com/novapay-support",
        "followers": 340,
        "verified_official": False,
    },
    {
        "id": 3,
        "brand": "NovaPay",
        "profile_name": "Get NovaPay Rewards",
        "platform": "Facebook",
        "url": "https://demo.example.com/novapay-rewards",
        "followers": 86,
        "verified_official": False,
    },
]

mobile_apps = [
    {
        "id": 1,
        "brand": "NovaPay",
        "app_name": "NovaPay Official",
        "publisher": "NovaPay Technologies",
        "store": "Google Play",
        "official": True,
    },
    {
        "id": 2,
        "brand": "NovaPay",
        "app_name": "NovaPay Rewards Plus",
        "publisher": "Demo App Publisher",
        "store": "Google Play",
        "official": False,
    },
    {
        "id": 3,
        "brand": "NovaPay",
        "app_name": "Nova Pay Wallet",
        "publisher": "Unknown Demo Publisher",
        "store": "Demo App Store",
        "official": False,
    },
]


# ---------------------------
# Detection helpers
# ---------------------------

def normalise(value: str) -> str:
    """Ignore spaces and punctuation when comparing names."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def similarity(first: str, second: str) -> float:
    a = normalise(first)
    b = normalise(second)

    if not a or not b:
        return 0.0

    score = SequenceMatcher(None, a, b).ratio() * 100

    # Brand included within a longer profile/app name
    if a in b or b in a:
        score = max(score, 85.0)

    return round(score, 1)


def risk_assessment(score: float, official: bool) -> str:
    if official:
        return "Low"
    if score >= 85:
        return "High"
    if score >= 55:
        return "Medium"
    return "Low"


def get_brands():
    with connect_db() as db:
        rows = db.execute(
            "SELECT * FROM brands ORDER BY id DESC"
        ).fetchall()

    result = []
    for row in rows:
        item = dict(row)
        item["social_urls"] = json.loads(item["social_urls"])
        item["official_apps"] = json.loads(item["official_apps"])
        result.append(item)

    return result


def scan_social(brand_filter: Optional[str] = None):
    results = []

    for brand in get_brands():
        if brand_filter and brand["name"].lower() != brand_filter.lower():
            continue

        for profile in social_profiles:
            if profile["brand"].lower() != brand["name"].lower():
                continue

            score = similarity(brand["name"], profile["profile_name"])
            official = profile["verified_official"]

            results.append({
                **profile,
                "similarity_score": score,
                "risk_level": risk_assessment(score, official),
                "reason": (
                    "Marked official in the demo dataset"
                    if official
                    else "Similar brand name; ownership has not been verified"
                ),
                "data_source": "SIMULATED DEMO DATA",
            })

    return results


def scan_apps(brand_filter: Optional[str] = None):
    results = []

    for brand in get_brands():
        if brand_filter and brand["name"].lower() != brand_filter.lower():
            continue

        for mobile_app in mobile_apps:
            if mobile_app["brand"].lower() != brand["name"].lower():
                continue

            score = similarity(brand["name"], mobile_app["app_name"])
            official = mobile_app["official"]

            results.append({
                **mobile_app,
                "similarity_score": score,
                "risk_level": risk_assessment(score, official),
                "reason": (
                    "Marked official in the demo dataset"
                    if official
                    else "Similar app name; publisher has not been verified"
                ),
                "data_source": "SIMULATED DEMO DATA",
            })

    return results


# ---------------------------
# General and health routes
# ---------------------------

@app.get("/")
def home():
    return {
        "message": "BrandShield AI backend is running",
        "docs": "/docs",
        "data_mode": "DEMO",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy", "data_mode": "DEMO"}


# ---------------------------
# Brand profile routes
# ---------------------------

@app.get("/api/brands")
def list_brands():
    return get_brands()


@app.post("/api/brands", status_code=201)
def create_brand(brand: BrandCreate):
    if any(b["name"].lower() == brand.name.strip().lower()
           for b in get_brands()):
        raise HTTPException(
            status_code=409,
            detail="A brand with this name is already registered"
        )

    with connect_db() as db:
        cursor = db.execute("""
            INSERT INTO brands
            (name, website, logo_url, social_urls, official_apps)
            VALUES (?, ?, ?, ?, ?)
        """, (
            brand.name.strip(),
            brand.website,
            brand.logo_url,
            json.dumps(brand.social_urls),
            json.dumps(brand.official_apps),
        ))
        brand_id = cursor.lastrowid

    return {
        "message": "Brand registered successfully",
        "id": brand_id,
        "name": brand.name.strip(),
    }


@app.delete("/api/brands/{brand_id}")
def delete_brand(brand_id: int):
    with connect_db() as db:
        cursor = db.execute(
            "DELETE FROM brands WHERE id = ?", (brand_id,)
        )

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Brand not found")

    return {"message": "Brand deleted", "id": brand_id}


# ---------------------------
# Social monitoring routes
# ---------------------------

@app.get("/api/social")
def get_social_profiles(brand: Optional[str] = None):
    return scan_social(brand)


@app.post("/api/social")
def add_social_profile(profile: SocialProfileCreate):
    if not any(
        b["name"].lower() == profile.brand.strip().lower()
        for b in get_brands()
    ):
        raise HTTPException(
            status_code=404,
            detail="Register this brand before adding a profile"
        )

    new_id = max((p["id"] for p in social_profiles), default=0) + 1
    item = profile.model_dump()
    item["id"] = new_id
    item["brand"] = profile.brand.strip()
    social_profiles.append(item)

    return {"message": "Demo profile added", "profile": item}


# ---------------------------
# App monitoring routes
# ---------------------------

@app.get("/api/apps")
def get_mobile_apps(brand: Optional[str] = None):
    return scan_apps(brand)


@app.post("/api/apps")
def add_mobile_app(mobile_app: AppCreate):
    if not any(
        b["name"].lower() == mobile_app.brand.strip().lower()
        for b in get_brands()
    ):
        raise HTTPException(
            status_code=404,
            detail="Register this brand before adding an app"
        )

    new_id = max((a["id"] for a in mobile_apps), default=0) + 1
    item = mobile_app.model_dump()
    item["id"] = new_id
    item["brand"] = mobile_app.brand.strip()
    mobile_apps.append(item)

    return {"message": "Demo app added", "app": item}


# ---------------------------
# Dashboard and detections
# ---------------------------

@app.get("/api/dashboard")
def dashboard():
    social = scan_social()
    apps = scan_apps()
    all_items = social + apps

    detections = [
        item for item in all_items
        if item["risk_level"] in ("High", "Medium")
    ]

    return {
        "registered_brands": len(get_brands()),
        "social_profiles_scanned": len(social),
        "apps_scanned": len(apps),
        "suspicious_detections": len(detections),
        "high_risk": sum(
            item["risk_level"] == "High" for item in detections
        ),
        "medium_risk": sum(
            item["risk_level"] == "Medium" for item in detections
        ),
        "data_mode": "DEMO",
        "note": "Counts use simulated data, not live monitoring.",
    }


@app.get("/api/detections")
def get_detections():
    social = [
        {**item, "detection_type": "Social Profile"}
        for item in scan_social()
        if item["risk_level"] in ("High", "Medium")
    ]

    apps = [
        {**item, "detection_type": "Mobile App"}
        for item in scan_apps()
        if item["risk_level"] in ("High", "Medium")
    ]

    return social + apps
