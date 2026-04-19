import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCameraRotate, faRotateLeft, faDownload } from "@fortawesome/free-solid-svg-icons";

const Page = styled.div`
  height: 100dvh;
  background: #0f1216;
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

function drawTile(ctx, x, y, w, h, label, value, baseW) {
  const radius = w * 0.12;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = baseW * 0.015;
  ctx.shadowOffsetY = baseW * 0.004;
  ctx.fillStyle = "rgba(15,18,22,0.72)";
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(1, baseW * 0.002);
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();

  // Equal padding on all four sides
  const pad = Math.min(w, h) * 0.12;

  // Label (small, top-left)
  const labelSize = Math.round(baseW * 0.022);
  ctx.font = `500 ${labelSize}px -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(label.toUpperCase(), x + pad, y + pad);

  // Value (large, bottom-left). Auto-shrink to fit remaining tile width.
  const maxValueSize = Math.round(baseW * 0.055);
  const minValueSize = Math.round(baseW * 0.028);
  const maxWidth = w - pad * 2;
  let vSize = maxValueSize;
  ctx.textBaseline = "alphabetic";
  while (vSize > minValueSize) {
    ctx.font = `700 ${vSize}px -apple-system, "Segoe UI", sans-serif`;
    if (ctx.measureText(value).width <= maxWidth) break;
    vSize -= 2;
  }
  ctx.fillStyle = "white";
  ctx.fillText(value, x + pad, y + h - pad);
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

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState("camera");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState("user");
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [weather, setWeather] = useState(null);
  const [emojis, setEmojis] = useState([]);
  const photoImgRef = useRef(null);
  const abortRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    startCamera("user");
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
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1440 }, height: { ideal: 1920 } },
        audio: false
      });
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
    drawOverlay(ctx, canvas, weather, emojis);
  }

  function drawOverlay(ctx, canvas, weather, emojis) {
    const w = canvas.width;
    const h = canvas.height;

    // Weather grid (top-left): 3 tiles — temp, condition, location
    if (weather && !weather.error && weather.condition) {
      const margin = w * 0.04;
      const gap = w * 0.02;
      const cellW = (w - margin * 2 - gap * 2) / 3;
      const cellH = cellW * 0.9;
      const y = margin;

      const cells = [
        { label: "Temp", value: `${Math.round(weather.temp_f)}°` },
        { label: "Weather", value: weather.condition },
        { label: "Place", value: weather.location }
      ];

      cells.forEach((cell, i) => {
        const x = margin + i * (cellW + gap);
        drawTile(ctx, x, y, cellW, cellH, cell.label, cell.value, w);
      });
    }

    // 3 emoji stickers scattered along the bottom
    if (emojis.length) {
      const size = Math.round(w * 0.2);
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", emoji`;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";

      const positions = [
        { x: w * 0.2, y: h * 0.88, rot: -0.12 },
        { x: w * 0.5, y: h * 0.94, rot: 0.04 },
        { x: w * 0.8, y: h * 0.86, rot: 0.14 }
      ];

      emojis.forEach((emoji, i) => {
        const p = positions[i] || positions[0];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = w * 0.015;
        ctx.shadowOffsetY = w * 0.005;
        ctx.fillText(emoji, 0, 0);
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
          </ShutterRow>
        )}
      </Bottom>
    </Page>
  );
}
