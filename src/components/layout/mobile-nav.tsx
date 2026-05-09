"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Route,
  Languages,
  FileText,
  Calculator,
  Map,
  Trophy,
  Settings,
  Briefcase,
  X,
} from "lucide-react";
import { MapleLeaf } from "@/components/ui/maple-leaf";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journey", label: "Jornada", icon: Route },
  { href: "/jobs", label: "Vagas", icon: Briefcase },
  { href: "/languages", label: "Idiomas", icon: Languages },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/simulator", label: "Simulador CRS", icon: Calculator },
  { href: "/plans", label: "Meus Planos", icon: Map },
  { href: "/achievements", label: "Conquistas", icon: Trophy },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  // Close on route change
  React.useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
          <div className="flex items-center gap-2.5">
            <MapleLeaf size={26} className="text-primary" />
            <span className="text-base font-bold tracking-tight text-foreground">
              MapleTrack
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "text-foreground-muted hover:bg-surface hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.25]")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-4">
          <p className="text-[10px] text-foreground-dim text-center">
            MapleTrack &middot; Sua jornada para o Canada
          </p>
        </div>
      </aside>
    </>
  );
}
