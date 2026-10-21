import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# Render sits in front of the app as a proxy. ProxyFix lets Flask see the real
# visitor address and the https:// version of the site URL.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MESSAGES_FILE = os.path.join(BASE_DIR, "messages.json")

# Settings read from environment variables (set these on Render, never in code).
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
CONTACT_TO_EMAIL = os.environ.get("CONTACT_TO_EMAIL")
CONTACT_FROM_EMAIL = os.environ.get("CONTACT_FROM_EMAIL", "Portfolio <onboarding@resend.dev>")

EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")

# Simple spam protection: at most 5 messages per visitor every 10 minutes.
RATE_LIMIT_WINDOW = 10 * 60
RATE_LIMIT_MAX = 5
recent_submissions = {}


def is_rate_limited(visitor):
    now = time.time()
    times = [t for t in recent_submissions.get(visitor, []) if now - t < RATE_LIMIT_WINDOW]
    limited = len(times) >= RATE_LIMIT_MAX
    if not limited:
        times.append(now)
    recent_submissions[visitor] = times
    return limited


def send_email(name, email, message):
    """Send the message to Kevin's inbox through the Resend email API."""
    payload = {
        "from": CONTACT_FROM_EMAIL,
        "to": [CONTACT_TO_EMAIL],
        "reply_to": email,
        "subject": f"Portfolio message from {name}",
        "text": f"Name: {name}\nEmail: {email}\n\n{message}",
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "kevin-minchala-portfolio/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return 200 <= response.status < 300


def save_locally(entry):
    """Fallback for local testing: keep messages in messages.json."""
    messages = []
    if os.path.exists(MESSAGES_FILE):
        try:
            with open(MESSAGES_FILE, "r", encoding="utf-8") as f:
                messages = json.load(f)
        except json.JSONDecodeError:
            messages = []
    messages.append(entry)
    with open(MESSAGES_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or {}

    # Honeypot: real visitors never see or fill the "website" field, bots often do.
    if str(data.get("website", "")).strip():
        return jsonify({"success": True})

    name = " ".join(str(data.get("name", "")).split())[:100]
    email = str(data.get("email", "")).strip()[:200]
    message = str(data.get("message", "")).strip()

    if not name or not email or not message:
        return jsonify({"error": "Fill in your name, email, and message."}), 400
    if not EMAIL_PATTERN.fullmatch(email):
        return jsonify({"error": "Enter a valid email address, like name@example.com."}), 400
    if len(message) > 3000:
        return jsonify({"error": "Shorten your message to 3,000 characters or fewer."}), 400

    if is_rate_limited(request.remote_addr or "unknown"):
        return jsonify({"error": "Too many messages in a short time. Try again in a few minutes."}), 429

    entry = {
        "name": name,
        "email": email,
        "message": message,
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    if RESEND_API_KEY and CONTACT_TO_EMAIL:
        try:
            send_email(name, email, message)
        except urllib.error.HTTPError as err:
            app.logger.error("Resend rejected the email (%s): %s", err.code, err.read().decode("utf-8", "replace"))
            return jsonify({"error": "The message couldn't be delivered right now. Try again later or reach me on LinkedIn."}), 502
        except (urllib.error.URLError, TimeoutError) as err:
            app.logger.error("Could not reach Resend: %s", err)
            return jsonify({"error": "The message couldn't be delivered right now. Try again later or reach me on LinkedIn."}), 502
    else:
        save_locally(entry)
        app.logger.warning("Email isn't configured, so the message was saved to messages.json instead.")

    return jsonify({"success": True})


@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True)
