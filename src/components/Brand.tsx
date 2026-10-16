import { Link } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <RouteIcon className="h-5 w-5" />
      </span>
      <span className={`whitespace-nowrap font-display text-lg font-bold leading-none ${light ? "text-navy-foreground" : "text-foreground"}`}>
        Bnoy<span className="ml-1.5 hidden text-[10px] font-medium uppercase text-muted-foreground sm:inline">Logistics OS</span>
      </span>
    </Link>
  );
}
