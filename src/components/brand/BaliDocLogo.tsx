interface BaliDocLogoProps {
  /** icon height in px */
  size?: number;
  /** show the "BaliDoc" wordmark next to the icon */
  showText?: boolean;
  /** show the small tagline under the wordmark */
  showTagline?: boolean;
  /** render the wordmark in white (for use on a colored background) */
  light?: boolean;
  className?: string;
}

/** BaliDoc brand mark — a heart with a medical cross + pulse line. */
export function BaliDocLogo({
  size = 36,
  showText = true,
  showTagline = false,
  light = false,
  className = "",
}: BaliDocLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="balidocHeart" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF5A6E" />
            <stop offset="1" stopColor="#D11635" />
          </linearGradient>
        </defs>
        {/* Heart */}
        <path
          d="M24 43C24 43 4 31 4 17.5C4 10.6 9.4 6 15 6C19.2 6 22.4 8.4 24 11.4C25.6 8.4 28.8 6 33 6C38.6 6 44 10.6 44 17.5C44 31 24 43 24 43Z"
          fill="url(#balidocHeart)"
        />
        {/* Medical cross */}
        <rect x="21" y="14" width="6" height="17" rx="2" fill="#fff" />
        <rect x="15.5" y="19.5" width="17" height="6" rx="2" fill="#fff" />
        {/* Pulse line */}
        <path
          d="M11 33H18L20.5 28L24 37L27 31L29.5 33H37"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-xl font-extrabold tracking-tight">
            <span className={light ? "text-white" : "text-slate-800"}>Bali</span>
            <span className="text-red-600">Doc</span>
          </span>
          {showTagline && (
            <span
              className={`text-[9px] font-semibold tracking-[0.18em] mt-0.5 ${
                light ? "text-red-100" : "text-gray-400"
              }`}
            >
              YOUR HEALTH · OUR PRIORITY
            </span>
          )}
        </div>
      )}
    </div>
  );
}
