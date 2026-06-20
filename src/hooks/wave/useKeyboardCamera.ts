import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

type KeyboardCameraOptions = {
  enabled: boolean;
  domElement: HTMLElement | null;
};

type KeyboardCameraState = {
  keysRef: MutableRefObject<Set<string>>;
  mouseDeltaRef: MutableRefObject<{ dx: number; dy: number }>;
};

export function useKeyboardCamera({ enabled, domElement }: KeyboardCameraOptions): KeyboardCameraState {
  const keysRef = useRef<Set<string>>(new Set());
  const mouseDeltaRef = useRef({ dx: 0, dy: 0 });
  const isLookingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      keysRef.current.clear();
      mouseDeltaRef.current.dx = 0;
      mouseDeltaRef.current.dy = 0;
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        isLookingRef.current = true;
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 2) {
        isLookingRef.current = false;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isLookingRef.current) {
        return;
      }
      mouseDeltaRef.current.dx += event.movementX;
      mouseDeltaRef.current.dy += event.movementY;
    };

    const onContextMenu = (event: MouseEvent) => {
      if (enabled) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    if (domElement) {
      domElement.addEventListener('mousedown', onMouseDown);
      domElement.addEventListener('contextmenu', onContextMenu);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);

      if (domElement) {
        domElement.removeEventListener('mousedown', onMouseDown);
        domElement.removeEventListener('contextmenu', onContextMenu);
      }
    };
  }, [domElement, enabled]);

  return {
    keysRef,
    mouseDeltaRef,
  };
}
