"""
Accident Severity Prediction - Flask REST API
Production-ready version
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

from utils import preprocess_input, generate_recommendations, SEVERITY_LABELS

# =========================
# App Setup
# =========================
app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =========================
# Global variables
# =========================
model = None
scaler = None
encoder = None
prediction_log = []

BASE_DIR = os.path.dirname(__file__)

MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "encoder.pkl")


# =========================
# Load Model
# =========================
def load_model():
    global model, scaler, encoder

    try:
        if os.path.exists(MODEL_PATH):
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            encoder = joblib.load(ENCODER_PATH)
            logger.info("Model loaded successfully")

        else:
            logger.warning("Model not found. Training new model...")

            from train_model import train_and_save
            train_and_save()

            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            encoder = joblib.load(ENCODER_PATH)

            logger.info("Model trained and loaded")

    except Exception as e:
        logger.error(f"Model loading error: {e}")


# =========================
# Auto-load model (IMPORTANT for Gunicorn)
# =========================
load_model()


# =========================
# Health Check
# =========================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "time": datetime.now().isoformat()
    })


# =========================
# Predict API
# =========================
@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 503

    try:
        data = request.get_json()

        required = [
            "weather", "road_condition", "vehicle_type", "speed",
            "driver_age", "traffic_density", "time_of_day",
            "light_condition", "alcohol_involvement"
        ]

        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({"error": f"Missing fields: {missing}"}), 400

        speed = float(data["speed"])
        age = int(data["driver_age"])

        if not (0 <= speed <= 300):
            return jsonify({"error": "Invalid speed"}), 400
        if not (16 <= age <= 100):
            return jsonify({"error": "Invalid age"}), 400

        # preprocess
        features = preprocess_input(data, encoder, scaler)

        # prediction
        pred = int(model.predict(features)[0])
        probs = model.predict_proba(features)[0].tolist()
        confidence = float(max(probs))

        # factors
        factors = []

        if data["weather"] in ["rainy", "foggy", "storm"]:
            factors.append("Bad Weather")

        if data["road_condition"] in ["wet", "damaged"]:
            factors.append("Poor Road Condition")

        if speed > 80:
            factors.append("High Speed")

        if data["vehicle_type"] == "bike":
            factors.append("Bike Risk")

        if age < 25:
            factors.append("Young Driver")
        elif age > 65:
            factors.append("Elderly Driver")

        if data["traffic_density"] == "high":
            factors.append("Heavy Traffic")

        if data["time_of_day"] == "night":
            factors.append("Night Driving")

        if data.get("alcohol_involvement"):
            factors.append("Alcohol Involved")

        if not factors:
            factors = ["Normal Conditions"]

        recommendations = generate_recommendations(pred, factors)

        result = {
            "severity": pred,
            "label": SEVERITY_LABELS[pred],
            "confidence": round(confidence, 4),
            "probabilities": [round(p, 4) for p in probs],
            "factors": factors,
            "recommendations": recommendations,
            "timestamp": datetime.now().isoformat()
        }

        prediction_log.append(result)

        return jsonify(result)

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({"error": str(e)}), 500


# =========================
# Stats API
# =========================
@app.route("/stats", methods=["GET"])
def stats():
    return jsonify({
        "total_predictions": len(prediction_log),
        "recent": prediction_log[-10:][::-1],
        "model_loaded": model is not None,
        "time": datetime.now().isoformat()
    })


# =========================
# Logs API
# =========================
@app.route("/logs", methods=["GET"])
def logs():
    limit = request.args.get("limit", 50, type=int)
    return jsonify({
        "logs": prediction_log[-limit:][::-1],
        "total": len(prediction_log)
    })


# =========================
# RUN SERVER (LOCAL ONLY)
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting server on port {port}")
    app.run(host="0.0.0.0", port=port)