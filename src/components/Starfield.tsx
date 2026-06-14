import { useEffect, useRef } from "react";

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Star properties
    const numStars = 150;
    const stars: Array<{
      x: number;
      y: number;
      radius: number;
      depth: number;
      color: string;
      speed: number;
      pulse: number;
      pulseSpeed: number;
    }> = [];

    // Colors that match Cyber Observatory (electric cyan, neon violet, pure white stars)
    const starColors = [
      "rgba(6, 182, 212, ",  // Cyan
      "rgba(139, 92, 246, ", // Violet
      "rgba(167, 139, 250, ", // Soft purple
      "rgba(255, 255, 255, "  // White
    ];

    for (let i = 0; i < numStars; i++) {
      const depth = Math.random() * 0.8 + 0.2; // depth factor (0.2 to 1.0)
      const colorBase = starColors[Math.floor(Math.random() * starColors.length)];
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: (Math.random() * 1.5 + 0.5) * depth,
        depth,
        color: colorBase,
        speed: (Math.random() * 0.15 + 0.05) * depth,
        pulse: Math.random(),
        pulseSpeed: 0.01 + Math.random() * 0.02
      });
    }

    // Nebula dust effect parameters (2 faint clouds)
    const nebulae = [
      { x: width * 0.3, y: height * 0.4, r: Math.max(width, height) * 0.4, color: "rgba(139, 92, 246, 0.07)" },
      { x: width * 0.7, y: height * 0.6, r: Math.max(width, height) * 0.3, color: "rgba(6, 182, 212, 0.05)" }
    ];

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: entryWidth, height: entryHeight } = entry.contentRect;
        width = canvas.width = entryWidth;
        height = canvas.height = entryHeight;
        
        // Reposition stars that might be out of bounds
        stars.forEach(star => {
          if (star.x > width) star.x = Math.random() * width;
          if (star.y > height) star.y = Math.random() * height;
        });

        // Reposition nebulae
        nebulae[0].x = width * 0.3;
        nebulae[0].y = height * 0.4;
        nebulae[0].r = Math.max(width, height) * 0.4;
        nebulae[1].x = width * 0.7;
        nebulae[1].y = height * 0.6;
        nebulae[1].r = Math.max(width, height) * 0.3;
      }
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    const animate = () => {
      // Create trailing light effect slightly instead of full clearing to feel deep
      ctx.fillStyle = "rgba(4, 5, 15, 0.95)";
      ctx.fillRect(0, 0, width, height);

      // Draw faint Nebulae background
      nebulae.forEach((nebula) => {
        const grad = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
        grad.addColorStop(0, nebula.color);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw cosmic stars
      stars.forEach((star) => {
        // Star movement (slow drift down and left)
        star.y -= star.speed;
        star.x -= star.speed * 0.5;

        // Wrap around bounds
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }
        if (star.x < 0) {
          star.x = width;
          star.y = Math.random() * height;
        }

        // Pulse effect
        star.pulse += star.pulseSpeed;
        const opacity = (Math.sin(star.pulse) * 0.4 + 0.6) * star.depth;
        
        ctx.beginPath();
        ctx.fillStyle = `${star.color}${opacity.toFixed(2)})`;
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // Constellation highlight lines for larger stars
        if (star.radius > 1.2 && Math.random() < 0.002) {
          ctx.strokeStyle = "rgba(6, 182, 212, 0.05)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x + (Math.random() * 100 - 50), star.y + (Math.random() * 100 - 50));
          ctx.stroke();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      id="cyber-starfield"
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full block z-0"
    />
  );
}
