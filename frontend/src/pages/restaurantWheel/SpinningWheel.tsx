import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import type { Restaurant } from "./types";

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ef4444", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e879f9",
];

interface Props {
  restaurants: Restaurant[];
  onResult: (r: Restaurant) => void;
}

export default function SpinningWheel({ restaurants, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const angleRef = useRef(0);
  const animRef = useRef<number>(0);
  const sizeRef = useRef(400);

  const draw = useCallback(
    (angle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const size = sizeRef.current;
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 8;
      const count = restaurants.length;
      const arc = (Math.PI * 2) / count;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = window.devicePixelRatio || 1;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      // Draw segments
      for (let i = 0; i < count; i++) {
        const startAngle = angle + i * arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + arc);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(startAngle + arc / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(10, Math.min(14, 280 / count))}px -apple-system, sans-serif`;
        const label =
          restaurants[i].name.length > 18
            ? restaurants[i].name.slice(0, 16) + "\u2026"
            : restaurants[i].name;
        ctx.fillText(label, r - 12, 4);
        ctx.restore();
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#1e1e2e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pointer (top, pointing down into wheel)
      ctx.beginPath();
      ctx.moveTo(cx - 10, 2);
      ctx.lineTo(cx + 10, 2);
      ctx.lineTo(cx, 18);
      ctx.closePath();
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#1e1e2e";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    },
    [restaurants]
  );

  // Resize canvas for retina
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(container.clientWidth, container.clientHeight, 500);
      sizeRef.current = size;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      draw(angleRef.current);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // Redraw when restaurants change
  useEffect(() => {
    angleRef.current = 0;
    draw(0);
  }, [restaurants, draw]);

  const spin = () => {
    if (spinning || restaurants.length === 0) return;
    setSpinning(true);

    const count = restaurants.length;
    const arc = (Math.PI * 2) / count;
    // Pick random winner
    const winnerIdx = Math.floor(Math.random() * count);

    // The pointer is at the top = angle -π/2 in canvas coords.
    // Segment i center is at: currentAngle + i*arc + arc/2
    // We need: finalAngle + winnerIdx*arc + arc/2 ≡ -π/2 (mod 2π)
    // So: finalAngle ≡ -π/2 - winnerIdx*arc - arc/2 (mod 2π)
    const targetMod =
      ((-Math.PI / 2 - winnerIdx * arc - arc / 2) % (Math.PI * 2) + Math.PI * 2) %
      (Math.PI * 2);

    // Calculate how much to rotate forward from current position
    const currentMod = ((angleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = ((targetMod - currentMod) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    // Add 8-12 full rotations for drama
    delta += Math.PI * 2 * (8 + Math.random() * 4);

    const startAngle = angleRef.current;
    const finalAngle = startAngle + delta;
    const duration = 4000;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startAngle + (finalAngle - startAngle) * eased;
      angleRef.current = current;
      draw(current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        onResult(restaurants[winnerIdx]);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: "100%",
        minHeight: 300,
        flex: 1,
      }}
    >
      <canvas ref={canvasRef} style={{ maxWidth: "100%" }} />
      <Button
        variant="contained"
        size="large"
        onClick={spin}
        disabled={spinning || restaurants.length === 0}
        sx={{ fontWeight: 700, px: 5 }}
      >
        {spinning ? "Spinning..." : "SPIN"}
      </Button>
    </Box>
  );
}
