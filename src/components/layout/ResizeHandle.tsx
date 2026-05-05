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
      className={`shrink-0 ${
        orientation === "horizontal"
          ? "w-[3px] cursor-col-resize"
          : "h-[3px] cursor-row-resize"
      } bg-[#333] hover:bg-opita-500 active:bg-opita-600 transition-colors duration-150`}
      onMouseDown={handleMouseDown}
    />
  );
}
