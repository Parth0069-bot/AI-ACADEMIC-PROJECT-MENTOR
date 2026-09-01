/* =========================================================
   ORBIT ICON

   A small, realistic "3D" replacement for the flat lucide
   `Orbit` glyph: a glowing planet core with two tilted rings
   at different depths/opacities and an orbiting satellite,
   built entirely from layered gradients and shadows.
========================================================= */

export function OrbitIcon({
  active = false,
  size = 18,
}: {
  active?: boolean;
  size?: number;
}) {
  const boxSize = size + 16;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: boxSize, height: boxSize }}
      aria-hidden="true"
    >
      {/* outer glow */}
      <span
        className="absolute inset-0 rounded-full transition-opacity"
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.35) 0%, rgba(124,92,255,0) 70%)",
          opacity: active ? 1 : 0.55,
        }}
      />

      {/* back ring (behind the core, wider + flatter) */}
      <span
        className="orbit-icon-ring-b absolute rounded-full"
        style={{
          width: boxSize * 0.92,
          height: boxSize * 0.5,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-18deg)",
        }}
      />

      {/* planet core */}
      <span
        className="orbit-icon-core relative rounded-full"
        style={{ width: size * 0.62, height: size * 0.62 }}
      />

      {/* front ring (in front of the core, tilted the other way) */}
      <span
        className="orbit-icon-ring-a absolute rounded-full"
        style={{
          width: boxSize * 0.98,
          height: boxSize * 0.42,
          top: "52%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(22deg)",
        }}
      >
        {/* satellite riding the front ring */}
        <span
          className="orbit-icon-satellite absolute rounded-full"
          style={{
            width: Math.max(3, size * 0.16),
            height: Math.max(3, size * 0.16),
            top: "-1.5px",
            left: "8%",
          }}
        />
      </span>
    </span>
  );
}
