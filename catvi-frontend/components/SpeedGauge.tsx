"use client";
import { useEffect, useId, useRef, useState } from "react";

type Scale = "linear" | "log";

export interface SpeedGaugeProps {
  /** Viteza curentă, în unitatea `unit`. Peste `max`, acul rămâne la capăt, dar numărul arată valoarea reală. */
  value: number;
  max?: number;
  unit?: string;
  /** Lățimea maximă, în px. Sub această lățime componenta se micșorează. */
  size?: number;
  /** "log" dă mai mult spațiu vitezelor mici. */
  scale?: Scale;
  /** Prefixul pentru aria-label, ex. "Viteză download". */
  label?: string;
}

// Geometria e în unitățile viewBox-ului; la size=280 o unitate = 1px.
const VIEW_W = 280;
const VIEW_H = 250;
const CX = 140;
const CY = 140;
const R = 118;
const STROKE = 14;
const LABEL_R = R - 30;
const PIVOT_Y = CY - 28;
const NEEDLE_LEN = R * 0.35;
// Unghiuri matematice (0° = dreapta, sens trigonometric). Sweep negativ =
// sensul acelor de ceasornic pe ecran: 225° (stânga-jos) → -45° (dreapta-jos).
const START_ANGLE = 225;
const SWEEP = -270;
const ARC_LEN = (Math.abs(SWEEP) / 360) * 2 * Math.PI * R;
const DURATION_MS = 300;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// Rotunjit: Node și browserul pot diferi în ultimele zecimale ale lui cos/sin,
// iar diferența ar strica hidratarea.
const round = (n: number) => Math.round(n * 1000) / 1000;

function polar(radius: number, deg: number, cy = CY) {
  const rad = (deg * Math.PI) / 180;
  return { x: round(CX + radius * Math.cos(rad)), y: round(cy - radius * Math.sin(rad)) };
}

function toFraction(v: number, max: number, scale: Scale) {
  const c = clamp(v, 0, max);
  return scale === "log" ? Math.log10(1 + c) / Math.log10(1 + max) : c / max;
}

function ticksFor(max: number, scale: Scale) {
  if (scale === "linear") return Array.from({ length: 6 }, (_, i) => (max * i) / 5);
  // Valori „rotunde” 1-2-5, păstrate doar dacă nu se suprapun pe arc.
  const MIN_GAP = 0.14;
  const ticks = [0];
  let last = 0;
  for (let p = 1; p < max; p *= 10) {
    for (const m of [1, 2, 5]) {
      const v = m * p;
      const f = toFraction(v, max, scale);
      if (v < max && f - last >= MIN_GAP && 1 - f >= MIN_GAP) {
        ticks.push(v);
        last = f;
      }
    }
  }
  ticks.push(max);
  return ticks;
}

/** Interpolează spre `target` în ~300ms, ease-out; instant la prefers-reduced-motion. */
function useAnimatedNumber(target: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : DURATION_MS;
    const from = shownRef.current;
    let start = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = duration ? Math.min((now - start) / duration, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export default function SpeedGauge({
  value,
  max = 1000,
  unit = "Mbps",
  size = 280,
  scale = "linear",
  label = "Viteză download",
}: SpeedGaugeProps) {
  const safeMax = max > 0 ? max : 1;
  const target = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const shown = useAnimatedNumber(target);
  const meterValue = Math.min(target, safeMax);

  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `gauge-progress-${id}`;
  const haloId = `gauge-halo-${id}`;
  const glowId = `gauge-glow-${id}`;

  const frac = toFraction(shown, safeMax, scale);
  const angle = START_ANGLE + frac * SWEEP;
  const arcStart = polar(R, START_ANGLE);
  const arcEnd = polar(R, START_ANGLE + SWEEP);
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 1 1 ${arcEnd.x} ${arcEnd.y}`;
  const dot = polar(R, angle);
  const needleTip = polar(NEEDLE_LEN, angle, PIVOT_Y);
  const readout = `${target.toFixed(1)} ${unit}`;

  return (
    <div
      role="meter"
      aria-valuenow={meterValue}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuetext={readout}
      aria-label={`${label}: ${readout}`}
      style={{ width: "100%", maxWidth: size, marginInline: "auto" }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
            <stop offset="0" style={{ stopColor: "var(--gauge-progress-start, #8B5CF6)" }} />
            <stop offset="1" style={{ stopColor: "var(--gauge-progress-end, #A855F7)" }} />
          </linearGradient>
          <radialGradient id={haloId}>
            <stop offset="0" style={{ stopColor: "var(--gauge-halo, rgba(139, 92, 246, 0.22))" }} />
            <stop offset="1" style={{ stopColor: "var(--gauge-halo, rgba(139, 92, 246, 0.22))", stopOpacity: 0 }} />
          </radialGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="4"
              style={{ floodColor: "var(--gauge-glow, rgba(168, 85, 247, 0.7))" }}
            />
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R + 12} fill={`url(#${haloId})`} />

        <path
          d={arcPath}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={{ stroke: "var(--gauge-track, rgba(139, 92, 246, 0.15))" }}
        />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${frac * ARC_LEN} ${ARC_LEN}`}
          filter={`url(#${glowId})`}
        />
        <circle
          cx={dot.x}
          cy={dot.y}
          r={7}
          filter={`url(#${glowId})`}
          style={{ fill: "var(--gauge-dot, #C084FC)" }}
        />

        <g
          fontSize={13}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fill: "var(--gauge-label, rgba(196, 181, 253, 0.55))", fontFamily: "inherit" }}
        >
          {ticksFor(safeMax, scale).map((tick) => {
            const p = polar(LABEL_R, START_ANGLE + toFraction(tick, safeMax, scale) * SWEEP);
            return (
              <text key={tick} x={p.x} y={p.y}>
                {Math.round(tick)}
              </text>
            );
          })}
        </g>

        <line
          x1={CX}
          y1={PIVOT_Y}
          x2={needleTip.x}
          y2={needleTip.y}
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ stroke: "var(--gauge-needle, #FFFFFF)" }}
        />
        <circle
          cx={CX}
          cy={PIVOT_Y}
          r={10}
          strokeWidth={2}
          style={{
            fill: "var(--gauge-pivot-fill, #12081F)",
            stroke: "var(--gauge-pivot-stroke, #6B5B8E)",
          }}
        />

        <text
          x={CX}
          y={186}
          textAnchor="middle"
          fontSize={48}
          fontWeight={700}
          style={{
            fill: "var(--gauge-value, #FFFFFF)",
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shown.toFixed(1)}
        </text>
        <text
          x={CX}
          y={208}
          textAnchor="middle"
          fontSize={13}
          style={{ fill: "var(--gauge-unit, #9C8FBF)", fontFamily: "inherit" }}
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}
