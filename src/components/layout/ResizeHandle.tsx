import { useCallback, useRef, useEffect } from "react";

interface ResizeHandleProps {
  /** Callback con el delta de píxeles arrastrados */
  onResize: (delta: number) => void;
  /** Orientación del handle */
  orientation?: "horizontal" | "vertical";
}

/**
 * Handle de redimensionamiento arrastrable.
 * Se monta como una delgada barra entre dos paneles.
 * Usa refs para evitar re-renders durante el drag.
 */
export function ResizeHandle({
  onResize,
  orientation = "horizontal",
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const start = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      start.current = orientation === "horizontal" ? e.clientX : e.clientY;
      document.body.style.cursor =
        orientation === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.body.classList.add("is-resizing");
    },
    [orientation],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const current = orientation === "horizontal" ? e.clientX : e.clientY;
      const delta = current - start.current;
      start.current = current;
      onResizeRef.current(delta);
    },
    [orientation],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.body.classList.remove("is-resizing");
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`relative z-50 flex shrink-0 items-center justify-center ${
        orientation === "horizontal"
          ? "w-[6px] -mx-[3px] cursor-col-resize"
          : "h-[6px] -my-[3px] cursor-row-resize"
      } group`}
      role="separator"
      aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
      onMouseDown={handleMouseDown}
    >
      <div 
        className={`${
          orientation === "horizontal" ? "w-[2px] h-full" : "h-[2px] w-full"
        } bg-transparent group-hover:bg-aura-purple/50 group-active:bg-aura-purple/80 group-hover:shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-300 ease-out`}
      />
    </div>
  );
}
