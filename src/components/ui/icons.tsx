// Small, crisp inline SVG icons (replace emoji for a cleaner, professional look).
// Inherit color via `currentColor` and size via the `size` prop.

interface IconProps {
  size?: number;
  className?: string;
}

const svg = (size: number, className: string, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const TrashIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ));

export const PlusIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ));

export const CloseIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ));

export const GripIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ));

export const SparklesIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </>
  ));

export const UsersIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ));

export const BoardIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="11" rx="1" />
    </>
  ));

export const ChevronRightIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, <polyline points="9 18 15 12 9 6" />);

export const ArrowUpIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  ));

export const BellIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ));

export const PaperclipIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  ));

export const SmilePlusIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M22 11v1a10 10 0 1 1-9-10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
      <path d="M16 5h6" />
      <path d="M19 2v6" />
    </>
  ));

export const FileIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ));

export const ZapIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  ));

export const MessageIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ));

export const AtSignIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </>
  ));

export const RefreshIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ));

export const UserPlusIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>
  ));

export const PencilIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  ));

export const ChevronDownIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, <polyline points="6 9 12 15 18 9" />);

export const CheckIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, <polyline points="20 6 9 17 4 12" />);

export const SearchIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ));

export const FolderIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ));

export const GaugeIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M12 21a9 9 0 1 0-9-9" />
      <path d="M3 12h2" />
      <path d="M12 3v2" />
      <path d="M19 12h2" />
      <path d="M12 12l4-2" />
    </>
  ));

export const AlertTriangleIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ));

export const CalendarIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ));

export const BoldIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />
  ));

export const ItalicIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </>
  ));

export const HeadingIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="6" y1="4" x2="6" y2="20" />
      <line x1="18" y1="4" x2="18" y2="20" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </>
  ));

export const ListIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </>
  ));

export const ListOrderedIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </>
  ));

export const LinkIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ));

export const HighlighterIcon = ({ size = 16, className = "" }: IconProps) =>
  svg(size, className, (
    <>
      <path d="M9 11l-6 6v3h3l6-6" />
      <path d="M12 8l4 4" />
      <path d="M17 3l4 4-9 9-4-4z" />
    </>
  ));
