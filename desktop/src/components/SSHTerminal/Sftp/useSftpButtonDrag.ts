import { useSize } from "ahooks";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SftpButtonPosition = {
  x: number;
  y: number;
};

export type SftpButtonBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type UseSftpButtonDragOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  storageKey: string;
  margin: number;
  dragThreshold: number;
};

type DragState = {
  hasMoved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: SftpButtonPosition;
};

const getPositionRatio = (
  position: SftpButtonPosition,
  bounds: SftpButtonBounds,
) => ({
  x:
    bounds.maxX === bounds.minX
      ? 0
      : (position.x - bounds.minX) / (bounds.maxX - bounds.minX),
  y:
    bounds.maxY === bounds.minY
      ? 0
      : (position.y - bounds.minY) / (bounds.maxY - bounds.minY),
});

const getPositionFromRatio = (
  ratio: SftpButtonPosition,
  bounds: SftpButtonBounds,
) => ({
  x: bounds.minX + (bounds.maxX - bounds.minX) * ratio.x,
  y: bounds.minY + (bounds.maxY - bounds.minY) * ratio.y,
});

const isSamePosition = (left: SftpButtonPosition, right: SftpButtonPosition) =>
  left.x === right.x && left.y === right.y;

const getInitialButtonPosition = (
  storageKey: string,
): SftpButtonPosition | null => {
  const savedPosition = localStorage.getItem(storageKey);
  if (!savedPosition) {
    return null;
  }

  try {
    const parsedPosition = JSON.parse(
      savedPosition,
    ) as Partial<SftpButtonPosition>;
    if (
      typeof parsedPosition.x !== "number" ||
      typeof parsedPosition.y !== "number"
    ) {
      throw new Error("Invalid button position");
    }

    return {
      x: parsedPosition.x,
      y: parsedPosition.y,
    };
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
};

const getButtonBounds = (
  containerSize: { width: number; height: number } | undefined,
  buttonSize: { width: number; height: number } | undefined,
  margin: number,
): SftpButtonBounds | null => {
  if (
    !containerSize?.width ||
    !containerSize?.height ||
    !buttonSize?.width ||
    !buttonSize?.height
  ) {
    return null;
  }

  return {
    minX: margin,
    maxX: Math.max(margin, containerSize.width - buttonSize.width - margin),
    minY: margin,
    maxY: Math.max(margin, containerSize.height - buttonSize.height - margin),
  };
};

export function useSftpButtonDrag({
  containerRef,
  buttonRef,
  storageKey,
  margin,
  dragThreshold,
}: UseSftpButtonDragOptions) {
  const [buttonPosition, setButtonPosition] =
    useState<SftpButtonPosition | null>(() =>
      getInitialButtonPosition(storageKey),
    );
  const [isDraggingButton, setIsDraggingButton] = useState(false);
  const suppressButtonClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const previousButtonBoundsRef = useRef<SftpButtonBounds | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const containerSize = useSize(containerRef);
  const buttonSize = useSize(buttonRef);
  const buttonBounds = useMemo(
    () => getButtonBounds(containerSize, buttonSize, margin),
    [buttonSize, containerSize, margin],
  );

  const clampButtonPosition = useCallback(
    (position: SftpButtonPosition, bounds = buttonBounds) => {
      if (!bounds) {
        return position;
      }

      return {
        x: Math.min(Math.max(position.x, bounds.minX), bounds.maxX),
        y: Math.min(Math.max(position.y, bounds.minY), bounds.maxY),
      };
    },
    [buttonBounds],
  );

  const getDefaultButtonPosition = useCallback(() => {
    if (!buttonBounds) {
      return null;
    }

    return {
      x: buttonBounds.maxX,
      y: buttonBounds.maxY,
    };
  }, [buttonBounds]);

  useEffect(() => {
    if (!buttonBounds) {
      return;
    }

    const previousBounds = previousButtonBoundsRef.current;
    previousButtonBoundsRef.current = buttonBounds;

    setButtonPosition((currentPosition) => {
      if (!currentPosition) {
        return getDefaultButtonPosition();
      }

      const nextPosition = previousBounds
        ? clampButtonPosition(
            getPositionFromRatio(
              getPositionRatio(currentPosition, previousBounds),
              buttonBounds,
            ),
            buttonBounds,
          )
        : clampButtonPosition(currentPosition, buttonBounds);

      return isSamePosition(nextPosition, currentPosition)
        ? currentPosition
        : nextPosition;
    });
  }, [clampButtonPosition, buttonBounds, getDefaultButtonPosition]);

  useEffect(() => {
    if (isDraggingRef.current || !buttonPosition) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(buttonPosition));
  }, [buttonPosition, storageKey]);

  const stopDraggingButton = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      openDialogWhenNotDragged: boolean,
    ) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return false;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      dragStateRef.current = null;
      isDraggingRef.current = false;
      setIsDraggingButton(false);

      if (dragState.hasMoved) {
        suppressButtonClickRef.current = true;
      }

      return openDialogWhenNotDragged && !dragState.hasMoved;
    },
    [],
  );

  const onButtonPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    let position = buttonPosition;
    if (!position) {
      const container = containerRef.current;
      const parent = event.currentTarget.parentElement;
      if (!container || !parent) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      position = {
        x: parentRect.left - containerRect.left,
        y: parentRect.top - containerRect.top,
      };
      setButtonPosition(position);
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      hasMoved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
    };
    setIsDraggingButton(true);
    isDraggingRef.current = true;
  };

  const onButtonPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;

      if (!dragState.hasMoved) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < dragThreshold) {
          return;
        }

        dragState.hasMoved = true;
      }

      setButtonPosition(
        clampButtonPosition({
          x: dragState.startPosition.x + deltaX,
          y: dragState.startPosition.y + deltaY,
        }),
      );
    },
    [clampButtonPosition, dragThreshold],
  );

  const onButtonClick = useCallback(() => {
    if (suppressButtonClickRef.current) {
      suppressButtonClickRef.current = false;
      return false;
    }

    return true;
  }, []);

  return {
    buttonPosition,
    isDraggingButton,
    onButtonClick,
    onButtonPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) =>
      stopDraggingButton(event, false),
    onButtonPointerDown,
    onButtonPointerMove,
    onButtonPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) =>
      stopDraggingButton(event, true),
  };
}
