"use client";

/**
 * The Settings page's frame — a section menu, and ONE section on screen at a time.
 *
 * Settings had grown into one very long page: name, four review links, two scores,
 * notifications, logo, the whole menu, a suggestion editor for every dish, the till
 * connection and the danger zone, all stacked. Now it's split into sections:
 *
 *   • laptop / large tablet (1024px and wider): the menu sits down the left, always
 *     visible;
 *   • phone / small tablet: a sticky "☰ <section name>" bar at the top opens the
 *     same menu as a drawer that slides in from the left.
 *
 * ── Why hidden, not removed ─────────────────────────────────────────────────
 * The sections you're not looking at are HIDDEN (the `hidden` attribute), never
 * unmounted. Four of them (Restaurant, Review links, Ratings, Notifications) are ONE
 * form with ONE Save button — removing a section would drop its fields from the
 * save. Hidden fields still post. It also keeps anything half-typed in a section
 * when the owner hops away and comes back.
 *
 * The open section is mirrored into the URL (`?section=menu`), so a refresh — or a
 * link from the dashboard — lands on the right one.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SETTINGS_SECTIONS, type SectionId } from "./sections";

// ── Shared state: which section is open ─────────────────────────────────────

interface SectionContext {
  /** The section on screen. */
  active: SectionId;
  /** Open a section (ignored if this person doesn't have it). */
  go: (id: SectionId) => void;
}

const Ctx = createContext<SectionContext | null>(null);

/** For anything inside Settings that needs to know — or change — the open section. */
export function useSettingsSection(): SectionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettingsSection must be used inside <SettingsShell>.");
  return ctx;
}

/** One section's content. On the page (so its state survives), visible only when open. */
export function SettingsPanel({ id, children }: { id: SectionId; children: ReactNode }) {
  const { active } = useSettingsSection();
  return <div hidden={active !== id}>{children}</div>;
}

// ── Icons (inline SVG: no icon library, no network request) ─────────────────

const ICON_PATHS: Record<SectionId | "menu-open" | "close", ReactNode> = {
  restaurant: (
    <>
      <path d="M3.5 10 5 4h14l1.5 6z" />
      <path d="M4.5 10v10h15V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  reviews: <path d="m12 3.5 2.6 5.4 5.9.7-4.4 4 1.2 5.8L12 16.5l-5.3 2.9 1.2-5.8-4.4-4 5.9-.7z" />,
  ratings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  logo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 15.5-5-5-9.5 9.5" />
    </>
  ),
  menu: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  suggestions: (
    <>
      <path d="M4 5h16v11H9.5L5 20v-4H4z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  till: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14.5h3" />
    </>
  ),
  account: (
    <>
      <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  "menu-open": <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};

function Icon({ name, className }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ── The menu (the same list in the sidebar and in the drawer) ───────────────

function SectionList({
  sections,
  active,
  onPick,
}: {
  sections: SectionId[];
  active: SectionId;
  onPick: (id: SectionId) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {sections.map((id) => {
        const current = id === active;
        const danger = id === "account";
        return (
          // The destructive one sits apart, under a hairline, so it's never
          // mis-tapped as "just another settings page".
          <li key={id} className={danger ? "mt-2 border-t border-[#E2E8F0] pt-2" : undefined}>
            <button
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => onPick(id)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
                current
                  ? "bg-aqua-50 text-brand"
                  : danger
                    ? "text-red-600 hover:bg-red-50"
                    : "text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              }`}
            >
              <Icon
                name={id}
                className={`h-5 w-5 flex-none ${
                  current ? "text-aqua-600" : danger ? "text-red-500" : "text-[#94A3B8]"
                }`}
              />
              <span className="min-w-0 truncate">{SETTINGS_SECTIONS[id]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── The shell ───────────────────────────────────────────────────────────────

export default function SettingsShell({
  sections,
  initial,
  children,
}: {
  /** The sections THIS person gets, in menu order (a branch manager gets fewer). */
  sections: SectionId[];
  /** The section to open first (already checked by the server page). */
  initial: SectionId;
  children: ReactNode;
}) {
  const [active, setActive] = useState<SectionId>(initial);
  const [open, setOpen] = useState(false); // the phone drawer
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerId = useId();
  const titleId = useId();

  const go = useCallback(
    (id: SectionId) => {
      if (!sections.includes(id)) return;
      setActive(id);
      setOpen(false);
      // Mirror it into the URL without a reload (Next.js syncs its router with
      // replaceState). The `?square=` note from the trip to Square was a one-off,
      // so it goes once the owner moves on.
      const url = new URL(window.location.href);
      url.searchParams.set("section", id);
      url.searchParams.delete("square");
      window.history.replaceState(null, "", url);
      // A new section starts at its top — not wherever the last one was scrolled to.
      window.scrollTo({ top: 0 });
    },
    [sections]
  );

  // While the drawer is open: lock the page behind it, put focus inside it, keep
  // Tab from wandering out, close on Escape, and close if the screen grows wide
  // enough to show the sidebar instead (a tablet turned sideways).
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const toggle = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawer) return;
      const focusable = drawer.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (wide.matches) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onResize);
      toggle?.focus(); // back to the ☰ button that opened it
    };
  }, [open]);

  const ctx = useMemo(() => ({ active, go }), [active, go]);
  const position = sections.indexOf(active) + 1;

  return (
    <Ctx.Provider value={ctx}>
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* Phone / small tablet: the ☰ bar. Sticky, so the menu is one tap away
            however far down a long section the owner has scrolled. */}
        <div className="sticky top-0 z-30 -mx-5 mb-5 border-b border-[#E2E8F0] bg-white/90 px-5 py-2 backdrop-blur-md lg:hidden">
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl py-1 text-left"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-brand shadow-sm">
              <Icon name="menu-open" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-[#94A3B8]">Settings menu</span>
              <span className="block truncate text-base font-semibold text-[#0F172A]">
                {SETTINGS_SECTIONS[active]}
              </span>
            </span>
            <span className="flex-none text-xs font-medium text-[#94A3B8]">
              {position} of {sections.length}
            </span>
          </button>
        </div>

        {/* Laptop: the same menu, always visible. */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-6">
            <SectionList sections={sections} active={active} onPick={go} />
          </div>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>

      {/* The phone drawer. */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Tapping the dimmed page closes the menu (not a tab stop: the ✕ is). */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="sf-fade-in absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[2px]"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            className="sf-drawer-in absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <p id={titleId} className="text-lg font-semibold text-[#0F172A]">
                Settings
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            {/* Scrolls on its own, so every section is reachable on a short
                landscape phone too. */}
            <nav
              aria-label="Settings sections"
              className="flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <SectionList sections={sections} active={active} onPick={go} />
            </nav>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
