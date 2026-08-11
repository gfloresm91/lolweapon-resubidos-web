"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export default function Tooltip({ children, label, side = "top", align = "center", contentClassName = "" }) {
  if (!label) {
    return children;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={`app-tooltip ${contentClassName}`.trim()}
            side={side}
            align={align}
            sideOffset={8}
          >
            {label}
            <TooltipPrimitive.Arrow className="app-tooltip-arrow" width={10} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
