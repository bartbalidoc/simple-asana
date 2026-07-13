interface PlendexLogoProps {
  /** icon height in px */
  size?: number;
  /** show the "Plendex" wordmark next to the icon */
  showText?: boolean;
  /** show the small "by BaliDoc" credit under the wordmark */
  showTagline?: boolean;
  /** invert for use on a colored background (white tile, red columns) */
  light?: boolean;
  className?: string;
}

/**
 * Plendex brand mark — a rounded app tile holding three board columns at
 * different stages: the product itself, abstracted. Shares the BaliDoc
 * heart's red gradient so the two marks read as one family
 * ("Plendex by BaliDoc").
 */
export function PlendexLogo({
  size = 36,
  showText = true,
  showTagline = false,
  light = false,
  className = "",
}: PlendexLogoProps) {
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
          <linearGradient
            id="plendexTile"
            x1="8"
            y1="4"
            x2="40"
            y2="44"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F43F5E" />
            <stop offset="1" stopColor="#B91C1C" />
          </linearGradient>
        </defs>
        {/* App tile */}
        <rect
          x="3"
          y="3"
          width="42"
          height="42"
          rx="11"
          fill={light ? "#ffffff" : "url(#plendexTile)"}
        />
        {/* Three board columns — work in different stages */}
        <rect x="11.5" y="12" width="6.5" height="24" rx="3.25" fill={light ? "#DC2626" : "#fff"} />
        <rect
          x="20.75"
          y="12"
          width="6.5"
          height="14"
          rx="3.25"
          fill={light ? "#DC2626" : "#fff"}
          opacity={light ? 1 : 0.92}
        />
        <rect
          x="30"
          y="12"
          width="6.5"
          height="19"
          rx="3.25"
          fill={light ? "#DC2626" : "#fff"}
          opacity={light ? 1 : 0.84}
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`text-xl font-extrabold tracking-tight ${
              light ? "text-white" : "text-slate-800"
            }`}
          >
            Plendex
          </span>
          {showTagline && (
            <span
              className={`text-[10px] font-semibold mt-1 ${
                light ? "text-red-100" : "text-gray-400"
              }`}
            >
              by Bali<span className={light ? "text-white" : "text-red-500"}>Doc</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
