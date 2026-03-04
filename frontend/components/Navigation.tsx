"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";

interface NavigationProps {
  theme: Theme;
}

export default function Navigation({ theme }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem("headerCollapsed") === "true");
    } catch {}

    const onCollapsed = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setIsCollapsed(detail);
    };

    window.addEventListener("header:collapse-changed", onCollapsed);
    return () =>
      window.removeEventListener("header:collapse-changed", onCollapsed);
  }, []);

  if (isCollapsed) {
    return null;
  }

  const pages = [
    { id: "/", label: "DASHBOARD" },
    { id: "/flow-analysis", label: "FLOW ANALYSIS" },
    { id: "/gamma-exposure", label: "GAMMA EXPOSURE" },
    { id: "/intraday-tools", label: "INTRADAY TOOLS" },
    { id: "/max-pain", label: "MAX PAIN" },
    { id: "/about", label: "ABOUT" },
  ];

  return (
    <nav
      className="border-b hidden md:block sticky z-30"
      style={{
        backgroundColor: theme === "dark" ? colors.bgDark : colors.bgLight,
        borderColor: colors.muted,
        top: "var(--zgx-header-height, 0px)",
      }}
    >
      <div className="container mx-auto px-6">
        <div className="flex overflow-x-hidden justify-center">
          {pages.map((page) => {
            const isActive = pathname === page.id;

            return (
              <button
                key={page.id}
                onClick={() => router.push(page.id)}
                className="px-6 py-4 font-semibold text-sm whitespace-nowrap transition-all duration-200 relative group"
                style={{
                  color: isActive
                    ? colors.bearish
                    : theme === "dark"
                      ? colors.light
                      : colors.dark,
                  opacity: isActive ? 1 : 0.6,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.backgroundColor =
                      theme === "dark"
                        ? `${colors.bearish}10`
                        : `${colors.bearish}05`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = "0.6";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {page.label}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      backgroundColor: colors.bearish,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
