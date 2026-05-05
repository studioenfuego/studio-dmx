"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sliders,
  Network,
  BookOpen,
  Cpu,
  Settings,
  Zap,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDMXStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { href: "/faders", label: "Faders", icon: Sliders },
  { href: "/routing", label: "Routing", icon: Network },
  { href: "/presets", label: "Presets", icon: BookOpen },
  { href: "/fixtures", label: "Fixtures", icon: Cpu },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { wsConnected, grandMaster, channels } = useDMXStore();
  const activeChannels = channels.filter((c) => c > 0).length;

  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-2 bg-card border-r border-border shrink-0">
      <div className="mb-4 flex flex-col items-center gap-1">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">DMX</span>
        </div>
      </div>

      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger render={
                <Link
                  href={href}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                />
              }>
                <Icon size={18} />
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 mt-auto">
        <Tooltip>
          <TooltipTrigger>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", wsConnected ? "text-green-400" : "text-red-400")}>
              {wsConnected ? <Zap size={14} /> : <ZapOff size={14} />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {wsConnected ? "Connected" : "Disconnected"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-2 h-10 rounded-full bg-muted relative overflow-hidden cursor-default">
                <div className="absolute bottom-0 left-0 right-0 rounded-full bg-amber-400 transition-all" style={{ height: `${(grandMaster / 255) * 100}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground">GM</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            Grand Master: {Math.round((grandMaster / 255) * 100)}%
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono cursor-default">
              {activeChannels}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="right">
            {activeChannels} active DMX channels
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
