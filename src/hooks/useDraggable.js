import { useState, useCallback, useRef } from 'react';

export default function useDraggable() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e) => {
    // Only primary button
    if (e.button !== 0) return;
    dragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...position };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';

    const target = e.currentTarget;

    const handlePointerMove = (ev) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;
      setPosition({
        x: startOffset.current.x + dx,
        y: startOffset.current.y + dy
      });
    };

    const handlePointerUp = () => {
      dragging.current = false;
      target.style.cursor = 'grab';
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [position]);

  const resetPosition = useCallback(() => setPosition({ x: 0, y: 0 }), []);

  return { position, handlePointerDown, resetPosition };
}
