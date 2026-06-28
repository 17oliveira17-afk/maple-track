"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Map,
  Route,
  FileText,
  Languages,
  Calculator,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
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

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col border-r border-border/60 bg-white shadow-sm transition-all duration-300 md:flex",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <MapleLeaf size={28} className="shrink-0 text-primary" />
        {!isCollapsed && (
          <span className="text-lg font-bold tracking-tight text-[#222222]">
            MapleTrack
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/8 text-primary"
                  : "text-[#717171] hover:bg-[#F7F7F7] hover:text-[#222222]"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.25]")} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex h-12 items-center justify-center border-t border-border/60 text-[#717171] transition-colors hover:bg-[#F7F7F7] hover:text-[#222222]"
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </aside>
  );
}
