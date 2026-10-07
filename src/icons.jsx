// Line icons for the navigation, drawn on a 24px grid in the current text colour.
const PATHS = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h4.5v-5h3v5H18v-9" /></>,
  register: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6v2.5H9z" /><path d="m8.5 13 2.2 2.2 4.8-4.7" /></>,
  reports: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z" /><path d="M13.5 3.5V8h4.5" /><path d="M9.5 17v-3M12 17v-5M14.5 17v-2" /></>,
  messages: <><path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2z" /><path d="M8.5 9.5h7M8.5 12.5h4.5" /></>,
  students: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.8-3 3-4.8 5.5-4.8s4.7 1.8 5.5 4.8" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M15.5 14.4c2.3-.2 4.2 1.3 5 4.1" /></>,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  more: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8v.5" /><path d="M12 16.8v.2" /></>,
  links: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M14.5 4.5v15M16.8 8.5h1.7M16.8 11.5h1.7M16.8 14.5h1.7" /></>,
}

export function NavIcon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.more}
    </svg>
  )
}
