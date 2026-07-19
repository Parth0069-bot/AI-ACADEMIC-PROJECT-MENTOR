import { cn } from "@/lib/utils";

type MascotPose = "wave" | "graduate" | "point";

export function Mascot({
  pose = "wave",
  className,
}: {
  pose?: MascotPose;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 280 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-auto", className)}
      role="img"
      aria-label="Friendly mentor bot illustration"
    >
      <ellipse cx="140" cy="272" rx="58" ry="9" fill="#3F2390" opacity="0.12" />

      <line x1="140" y1="46" x2="140" y2="20" stroke="#B6A6FF" strokeWidth="5" strokeLinecap="round" />
      <circle cx="140" cy="14" r="10" fill="#FFC24B" />
      <circle cx="137" cy="11" r="3" fill="white" opacity="0.7" />

      <rect x="52" y="96" width="16" height="34" rx="8" fill="#D5CDFF" />
      <rect x="212" y="96" width="16" height="34" rx="8" fill="#D5CDFF" />

      <rect x="66" y="44" width="148" height="116" rx="46" fill="#FDFCFF" stroke="#E9E5FF" strokeWidth="2" />
      <rect x="66" y="44" width="148" height="60" rx="46" fill="url(#sheen)" />

      <rect x="90" y="70" width="100" height="66" rx="28" fill="#3F2390" />
      <rect x="90" y="70" width="100" height="30" rx="28" fill="white" opacity="0.06" />

      <circle cx="120" cy="103" r="10" fill="#B6A6FF" />
      <circle cx="160" cy="103" r="10" fill="#B6A6FF" />
      <circle cx="120" cy="103" r="5" fill="#FDFCFF" />
      <circle cx="160" cy="103" r="5" fill="#FDFCFF" />
      <circle cx="122" cy="100" r="1.6" fill="#3F2390" />
      <circle cx="162" cy="100" r="1.6" fill="#3F2390" />

      <path d="M124 118 Q140 130 156 118" stroke="#B6A6FF" strokeWidth="3.5" strokeLinecap="round" fill="none" />

      <circle cx="100" cy="118" r="6" fill="#FF9EB0" opacity="0.55" />
      <circle cx="180" cy="118" r="6" fill="#FF9EB0" opacity="0.55" />

      <rect x="126" y="156" width="28" height="14" rx="6" fill="#E9E5FF" />

      <rect x="82" y="166" width="116" height="96" rx="36" fill="#7C5CFF" />
      <rect x="82" y="166" width="116" height="40" rx="36" fill="white" opacity="0.08" />
      <rect x="108" y="188" width="64" height="44" rx="16" fill="#FDFCFF" />
      <circle cx="140" cy="210" r="11" fill="#22C58B" />
      <circle cx="140" cy="210" r="5" fill="#DCF9EE" />

      <circle cx="94" cy="200" r="4" fill="#5D2FE0" />
      <circle cx="94" cy="214" r="4" fill="#5D2FE0" />

      {pose === "wave" && (
        <g>
          <path d="M196 196 Q228 186 232 152" stroke="#7C5CFF" strokeWidth="19" strokeLinecap="round" />
          <circle cx="234" cy="144" r="17" fill="#FDFCFF" stroke="#E9E5FF" strokeWidth="2" />
          <circle cx="228" cy="140" r="3" fill="#B6A6FF" />
          <circle cx="240" cy="140" r="3" fill="#B6A6FF" />
        </g>
      )}

      {pose === "graduate" && (
        <g>
          <path d="M82 196 Q56 196 52 222" stroke="#7C5CFF" strokeWidth="19" strokeLinecap="round" />
          <path d="M196 196 Q222 196 226 222" stroke="#7C5CFF" strokeWidth="19" strokeLinecap="round" />
          <rect x="98" y="20" width="84" height="16" rx="3" fill="#3F2390" transform="rotate(-6 140 28)" />
          <rect x="130" y="6" width="20" height="20" rx="3" fill="#3F2390" transform="rotate(-6 140 16)" />
          <circle cx="184" cy="40" r="4" fill="#FFC24B" />
          <line x1="182" y1="36" x2="184" y2="52" stroke="#FFC24B" strokeWidth="2" />
        </g>
      )}

      {pose === "point" && (
        <g>
          <path d="M196 194 Q240 190 254 164" stroke="#7C5CFF" strokeWidth="19" strokeLinecap="round" />
          <circle cx="258" cy="156" r="15" fill="#FDFCFF" stroke="#E9E5FF" strokeWidth="2" />
          <path d="M82 196 Q56 196 52 222" stroke="#7C5CFF" strokeWidth="19" strokeLinecap="round" />
        </g>
      )}

      <defs>
        <linearGradient id="sheen" x1="66" y1="44" x2="214" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9E5FF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#E9E5FF" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
