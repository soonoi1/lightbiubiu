
import React, { useState, useRef, useEffect } from 'react';

interface DraggablePanelProps {
  title?: string;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  onReset?: () => void;
  resizable?: boolean;
  className?: string;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  initialX,
  initialY,
  initialWidth,
  initialHeight = 200,
  minWidth = 150,
  minHeight = 80,
  children,
  onReset,
  resizable = true,
  className = ''
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.width,
      h: size.height
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        });
      }
      if (isResizing.current && resizable) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        setSize({
          width: Math.max(minWidth, resizeStart.current.w + dx),
          height: Math.max(minHeight, resizeStart.current.h + dy)
        });
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizable, minWidth, minHeight]);

  return (
    <div
      className={`fixed flex flex-col bg-[#050505]/80 backdrop-blur-xl rounded-lg border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden z-50 transition-shadow duration-200 hover:shadow-[0_8px_40px_rgba(0,0,0,0.8)] ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: resizable ? size.height : 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()} 
    >
      {/* Header Bar */}
      <div 
        className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 cursor-grab active:cursor-grabbing select-none shrink-0"
        onMouseDown={handleMouseDown}
      >
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/60 font-semibold">{title}</span>
        {onReset && (
             <button 
                onClick={(e) => { e.stopPropagation(); onReset(); }}
                className="text-[9px] text-white/30 hover:text-white transition-colors"
                title="Reset to Defaults"
            >
                RESET
            </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
        {children}
      </div>

      {/* Resize Handle */}
      {resizable && (
        <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center opacity-30 hover:opacity-100 z-10"
            onMouseDown={handleResizeDown}
        >
            <div className="w-1.5 h-1.5 border-r border-b border-white/80" />
        </div>
      )}
    </div>
  );
};
