import 'dotenv/config';
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3116;
const anthropic = new Anthropic();


// SQLite setup
const db = new Database(join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

app.use(express.json({ limit: "15mb" }));

// Serve static files from dist
app.use(express.static(join(__dirname, "dist")));

// API endpoint for SQLite queries
app.post("/api/query", (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all(...params);
      res.json({ rows });
    } else {
      const result = stmt.run(...params);
      res.json({ result });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3 emojis + 3 words from Claude vision, given a base64 image
app.post("/api/emojis", async (req, res) => {
  try {
    const { imageBase64, mediaType = "image/jpeg" } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 required" });
    }

    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 }
            },
            {
              type: "text",
              text: 'Look at this photo. Pick exactly 3 emojis and 3 single lowercase words that best capture its mood, subjects, and setting. Reply with ONLY a JSON object in this exact shape, no prose, no code fences: {"emojis":"XXX","words":["a","b","c"]} where XXX is the 3 emojis concatenated with no spaces.'
            }
          ]
        }
      ]
    });

    const raw = (result.content?.[0]?.text || "").trim();
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (e) {
      console.error("/api/emojis parse error; raw:", raw);
      return res.status(502).json({ error: "could not parse model response", raw });
    }

    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const emojis = [...segmenter.segment(String(parsed.emojis || ""))]
      .map((s) => s.segment)
      .filter((s) => s.trim() && !/^[a-z0-9.,!?'"`\-]+$/i.test(s))
      .slice(0, 3);

    const words = Array.isArray(parsed.words)
      ? parsed.words.map((w) => String(w).trim()).filter(Boolean).slice(0, 3)
      : [];

    res.json({ emojis, words });
  } catch (error) {
    console.error("/api/emojis failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reverse geocode lat/lon → street-level address via OpenStreetMap Nominatim
app.get("/api/reverse-geocode", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "zap.fcc.lol (leo@leomancinidesign.com)" }
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    const a = data.address || {};
    const address = [a.house_number, a.road].filter(Boolean).join(" ");

    // Nominatim sometimes skips `neighbourhood` and only fills `suburb` (which is
    // the borough in NYC). Parse the display_name tokens between the road and the
    // suburb/city to find the real neighborhood (e.g. "Williamsburg").
    let neighborhood = a.neighbourhood || a.quarter || a.hamlet || "";
    if (!neighborhood) {
      const tokens = String(data.display_name || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const roadIdx = a.road ? tokens.indexOf(a.road) : -1;
      const excluded = new Set(
        [
          a.house_number,
          a.road,
          a.suburb,
          a.city,
          a.town,
          a.village,
          a.municipality,
          a.borough,
          a.county,
          a.state_district,
          a.state,
          a.postcode,
          a.country,
          a.country_code
        ]
          .filter(Boolean)
          .map(String)
      );
      if (roadIdx >= 0 && roadIdx + 1 < tokens.length) {
        const candidate = tokens[roadIdx + 1];
        if (candidate && !excluded.has(candidate)) neighborhood = candidate;
      }
      if (!neighborhood) neighborhood = a.suburb || "";
    }

    const city = a.city || a.town || a.village || a.municipality || "";
    const state = a.state || "";
    const country = a.country || "";
    const lower = (s) => (s || "").toLowerCase();
    const cityLower = lower(city);
    const cityDisplay = cityLower === "new york" ? "new york city" : cityLower;
    res.json({
      address: lower(address),
      neighborhood: lower(neighborhood),
      city: cityDisplay,
      state: lower(state),
      country: lower(country),
      raw: data.display_name
    });
  } catch (error) {
    console.error("/api/reverse-geocode failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Current weather via weatherapi.com
app.get("/api/weather", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const key = process.env.WEATHER_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "WEATHER_API_KEY not set" });
    }

    let q;
    if (lat && lon) {
      q = `${lat},${lon}`;
    } else {
      // Fall back to IP-based lookup
      const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
      const raw = fwd || req.socket.remoteAddress || "";
      const ip = raw.replace(/^::ffff:/, "");
      const isLocal = !ip || ip === "127.0.0.1" || ip === "::1";
      q = isLocal ? "auto:ip" : ip;
    }

    const url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=${encodeURIComponent(q)}&aqi=no`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    res.json({
      temp_f: data.current.temp_f,
      temp_c: data.current.temp_c,
      condition: data.current.condition.text,
      location: data.location.name,
      region: data.location.region,
      icon: data.current.condition.icon,
      lat: data.location.lat,
      lon: data.location.lon
    });
  } catch (error) {
    console.error("/api/weather failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
