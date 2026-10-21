import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MESSAGES_FILE = os.path.join(BASE_DIR, "messages.json")


def load_messages():
    if not os.path.exists(MESSAGES_FILE):
        return []
    try:
        with open(MESSAGES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []


def save_messages(messages):
    with open(MESSAGES_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name or not email or not message:
        return jsonify({"error": "Please fill in every field."}), 400
    if "@" not in email:
        return jsonify({"error": "That email address doesn't look right."}), 400
    if len(message) > 2000:
        return jsonify({"error": "Message is too long (2000 characters max)."}), 400

    messages = load_messages()
    messages.append({
        "name": name,
        "email": email,
        "message": message,
        "time": datetime.now().isoformat(timespec="seconds")
    })
    save_messages(messages)

    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)