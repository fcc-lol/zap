import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCameraRotate,
  faRotateLeft,
  faDownload,
  faCloudArrowUp
} from "@fortawesome/free-solid-svg-icons";

const Page = styled.div`
  height: 100dvh;
  background: #000000;
  color: #f4f6fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 40px;
  box-sizing: border-box;
  overflow: hidden;
`;

const Middle = styled.div`
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Bottom = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
`;

const Stage = styled.div`
  position: relative;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 1 / 1;
  background: #1a1f26;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: ${(p) => (p.$visible ? "block" : "none")};
  transform: ${(p) => (p.$mirrored ? "scaleX(-1)" : "none")};
  opacity: ${(p) => (p.$ready ? 1 : 0)};
  transition: opacity 0.35s ease;
`;

const FlipButton = styled.button`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: #2a313b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, opacity 0.2s ease;
  &:hover:not(:disabled) {
    background: #343c47;
  }
  &:active:not(:disabled) {
    transform: scale(0.92);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  font-size: 20px;
`;

const ShutterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 76px;
`;

const shimmerKeyframes = `
  @keyframes zap-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

const Shimmer = styled.div`
  ${shimmerKeyframes}
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: ${(p) => (p.$active ? 1 : 0)};
  transition: opacity 0.2s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      transparent 20%,
      rgba(255, 255, 255, 0.18) 45%,
      rgba(255, 255, 255, 0.28) 50%,
      rgba(255, 255, 255, 0.18) 55%,
      transparent 80%
    );
    animation: zap-shimmer 1.4s linear infinite;
  }
`;

const Canvas = styled.canvas`
  @keyframes zap-pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.55; }
  }
  width: 100%;
  height: 100%;
  display: ${(p) => (p.$visible ? "block" : "none")};
  animation: ${(p) => (p.$loading ? "zap-pulse 1.4s ease-in-out infinite" : "none")};
`;

const Status = styled.div`
  font-size: 14px;
  color: #8a96a8;
  min-height: 20px;
  text-align: center;
`;

const Row = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
`;

const Button = styled.button`
  background: ${(p) => (p.$primary ? "#4f7cff" : "#2a313b")};
  color: white;
  border: none;
  padding: 12px 22px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.05s ease, background 0.15s ease;
  &:active {
    transform: scale(0.97);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Shutter = styled.button`
  width: 76px;
  height: 76px;
  border-radius: 50%;
  padding: 0;
  background: transparent;
  border: 4px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.08s ease;
  outline-offset: 6px;

  &::after {
    content: "";
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: white;
    transition: transform 0.08s ease, background 0.15s ease;
  }

  &:active::after {
    transform: scale(0.88);
  }

  &:disabled {
    cursor: not-allowed;
    &::after {
      background: #8a96a8;
    }
  }
`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const GEO_ERRORS = { 1: "PERMISSION_DENIED", 2: "POSITION_UNAVAILABLE", 3: "TIMEOUT" };

const IS_MOBILE =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        console.log("[geolocation] got fix:", {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy
        });
        resolve({ lat: p.coords.latitude, lon: p.coords.longitude });
      },
      (e) => {
        const label = GEO_ERRORS[e.code] || `code ${e.code}`;
        console.warn("[geolocation] error:", label, e.message, e);
        reject(new Error(`${label}${e.message ? ": " + e.message : ""}`));
      },
      { timeout: 15000, maximumAge: 5 * 60_000, enableHighAccuracy: false }
    );
  });
}

const isIOS = typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const defaultFacing = isIOS ? "environment" : "user";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState("camera");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState(defaultFacing);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [weather, setWeather] = useState(null);
  const [emojis, setEmojis] = useState([]);
  const [words, setWords] = useState([]);
  const photoImgRef = useRef(null);
  const abortRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    startCamera(defaultFacing);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the captured photo into an Image element whenever it changes
  useEffect(() => {
    if (!photoDataUrl) {
      photoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      photoImgRef.current = img;
      renderComposite();
    };
    img.src = photoDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoDataUrl]);

  // Redraw on every render while in preview — makes HMR edits to drawOverlay live
  useEffect(() => {
    if (mode === "preview") renderComposite();
  });

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera(nextFacing = facing) {
    abortRef.current?.abort();
    abortRef.current = null;
    stopCamera();
    setStatus("");
    setBusy(false);
    setWeather(null);
    setEmojis([]);
    setPhotoDataUrl(null);
    setVideoReady(false);
    try {
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing }, width: { ideal: 1440 }, height: { ideal: 1920 } },
          audio: false
        });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing, width: { ideal: 1440 }, height: { ideal: 1920 } },
          audio: false
        });
      }
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      setFacing(nextFacing);
      setMode("camera");
    } catch (e) {
      setStatus(`Camera error: ${e.message}`);
    }
  }

  async function flipCamera() {
    const next = facing === "environment" ? "user" : "environment";
    await startCamera(next);
  }

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;

    setBusy(true);
    setWeather(null);
    setEmojis([]);
    setWords([]);

    const vw = video.videoWidth || 1080;
    const vh = video.videoHeight || 1080;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    // Draw synchronously to the visible canvas to avoid a flash on mode switch
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    ctx.save();
    if (facing === "user") {
      ctx.translate(side, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
    ctx.restore();

    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = jpeg.split(",")[1];

    stopCamera();
    setPhotoDataUrl(jpeg);
    setMode("preview");

    const weatherP = (async () => {
      let query = "";
      let geoError = null;
      try {
        const { lat, lon } = await getLocation();
        query = `?lat=${lat}&lon=${lon}`;
      } catch (e) {
        geoError = e;
        console.warn("[weather] geolocation unavailable, falling back to server IP lookup:", e.message);
      }
      try {
        const url = `/api/weather${query}`;
        console.log("[weather] fetching:", url);
        const r = await fetch(url, { signal });
        const data = await r.json();
        if (!r.ok) {
          console.error("[weather] server error:", r.status, data);
          throw new Error(data.error || `weather ${r.status}`);
        }
        console.log("[weather] ok:", data);
        if (geoError) data._note = `geolocation failed (${geoError.message}), used IP lookup`;
        return data;
      } catch (e) {
        if (e.name !== "AbortError") console.error("[weather] fetch failed:", e);
        return { error: e.message };
      }
    })();

    const emojisP = fetch("/api/emojis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
      signal
    })
      .then((r) => r.json())
      .catch((e) => {
        if (e.name !== "AbortError") console.warn("emojis", e);
        return { emojis: [], error: e.message };
      });

    const [weatherData, emojisRes] = await Promise.all([weatherP, emojisP]);

    if (signal.aborted) return;

    setWeather(weatherData);
    setEmojis(emojisRes.emojis || []);
    setWords(emojisRes.words || []);

    const notes = [];
    if (weatherData?.error) notes.push(`Weather unavailable: ${weatherData.error}`);
    if (emojisRes?.error) notes.push(`Emojis unavailable: ${emojisRes.error}`);
    setStatus(notes.join(" · "));
    setBusy(false);
  }

  function renderComposite() {
    const canvas = canvasRef.current;
    const img = photoImgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    drawOverlay(ctx, canvas, weather, emojis, words);
  }

  function drawOverlay(ctx, canvas, weather, emojis, words) {
    const w = canvas.width;
    const monoStack = `ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const pad = Math.round(w * 0.05);

    const fontSize = Math.round(w * 0.04);
    const lineHeight = Math.round(fontSize * 1.4);

    function drawStackedText(lines, anchor) {
      ctx.textAlign = "left";
      ctx.textBaseline = anchor === "top" ? "top" : "alphabetic";
      ctx.fillStyle = "white";
      lines.forEach((raw, i) => {
        const text = String(raw).toLowerCase();
        let size = fontSize;
        ctx.font = `700 ${size}px ${monoStack}`;
        const maxWidth = w * 0.55;
        while (size > w * 0.028 && ctx.measureText(text).width > maxWidth) {
          size -= 2;
          ctx.font = `700 ${size}px ${monoStack}`;
        }
        const y =
          anchor === "top"
            ? pad + i * lineHeight
            : canvas.height - pad - (lines.length - 1 - i) * lineHeight;
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillText(text, pad, y);
        ctx.fillText(text, pad, y);
        ctx.restore();
      });
    }

    // Top-left: weather stack (lowercased)
    const weatherLines = [];
    if (weather && !weather.error && weather.condition) {
      weatherLines.push(`${Math.round(weather.temp_f)}°`);
      weatherLines.push(weather.condition);
      weatherLines.push(weather.location);
      if (typeof weather.lat === "number" && typeof weather.lon === "number") {
        weatherLines.push(`${weather.lat.toFixed(2)}°, ${weather.lon.toFixed(2)}°`);
      }
    }
    if (weatherLines.length) drawStackedText(weatherLines, "top");

    // Bottom-left: AI-generated descriptor words
    if (words?.length) drawStackedText(words, "bottom");

    // Top-right: emoji row
    if (emojis?.length) {
      const emojiSize = Math.round(w * 0.08);
      const gap = Math.round(w * 0.012);
      ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", emoji`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      const metrics = ctx.measureText(emojis[0]);
      const ascent = metrics.actualBoundingBoxAscent || emojiSize * 0.9;
      const glyphW = emojiSize;
      const totalW = emojis.length * glyphW + (emojis.length - 1) * gap;
      const startX = w - pad - totalW;
      const baselineY = pad + ascent;

      emojis.forEach((emoji, i) => {
        const x = startX + i * (glyphW + gap);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = w * 0.015;
        ctx.shadowOffsetY = w * 0.005;
        ctx.fillText(emoji, x, baselineY);
        ctx.restore();
      });

      ctx.textAlign = "start";
    }
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `zap-${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.click();
  }

  async function postToCloud() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isLocal = window.location.hostname === "localhost";
    const cloudApi = isLocal ? "http://localhost:3127" : "https://cloud.leo.gd";
    const cloudApp = isLocal ? "http://localhost:5174" : "https://cloud.leo.gd";
    const win = window.open(cloudApp, "_blank");
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    const form = new FormData();
    form.append("image", blob, "zap.jpg");
    try {
      const res = await fetch(`${cloudApi}/api/prefill-media`, {
        method: "POST",
        body: form
      });
      const { filename } = await res.json();
      const url = `${cloudApp}/?compose=${filename}&source=zap`;
      if (win) win.location = url;
    } catch (e) {
      console.warn("Post to Cloud failed:", e);
    }
  }

  return (
    <Page onTouchStart={() => {}}>
      <Middle>
        <Stage>
          <Video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => setVideoReady(true)}
            $visible={mode === "camera"}
            $mirrored={facing === "user"}
            $ready={videoReady}
          />
          <Canvas ref={canvasRef} $visible={mode === "preview"} $loading={busy && mode === "preview"} />
          <Shimmer $active={busy && mode === "preview"} />
        </Stage>
      </Middle>
      <Bottom>
        <Status>{status}</Status>
        {mode === "camera" && (
          <ShutterRow>
            {IS_MOBILE && <span style={{ width: 52 }} />}
            <Shutter onClick={capture} disabled={busy} aria-label="Take photo" />
            {IS_MOBILE && (
              <FlipButton onClick={flipCamera} disabled={busy} aria-label="Flip camera">
                <FontAwesomeIcon icon={faCameraRotate} />
              </FlipButton>
            )}
          </ShutterRow>
        )}
        {mode === "preview" && (
          <ShutterRow>
            <FlipButton onClick={() => startCamera()} aria-label="Retake">
              <FontAwesomeIcon icon={faRotateLeft} />
            </FlipButton>
            <FlipButton onClick={download} disabled={busy} aria-label="Download">
              <FontAwesomeIcon icon={faDownload} />
            </FlipButton>
            <FlipButton onClick={postToCloud} disabled={busy} aria-label="Share to Cloud">
              <FontAwesomeIcon icon={faCloudArrowUp} />
            </FlipButton>
          </ShutterRow>
        )}
      </Bottom>
    </Page>
  );
}
