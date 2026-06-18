// Reorder context — extracted from Draggable.tsx. The rule
// `react-refresh/only-export-components` is happy when each file
// only exports components, so the hook that reads the context
// lives here next to the context itself.

import { createContext, useContext } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { useDraggableOrder, reorderDraggable } from './draggable-order';

export interface ReorderContextValue {
  /** Notify the provider that widget `id` started a drag. */
  notifyDragStart: (id: string) => void;
  /** Notify drop at `targetIndex` (where the dragged widget
   *  should land). Returns true if the drop was accepted. */
  notifyDrop: (id: string, targetIndex: number) => boolean;
  /** Current order (for sibling rendering decisions). */
  getOrder: () => string[];
}

const ReorderContext = createContext<ReorderContextValue | null>(null);

export function useReorder(): ReorderContextValue | null {
  return useContext(ReorderContext);
}

// ── ReorderDragProvider — the layout wraps its Draggables in
//    this so they can talk to each other. The provider keeps
//    a single shared `draggingId` (who's being dragged) and
//    exposes drop notifications to all siblings.

export function ReorderDragProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  // Re-render the provider when the order changes so children
  // that read it see fresh data.
  const order = useDraggableOrder();
  // We track the currently-dragging widget id so the provider
  // can reject self-drops (a widget cannot reorder to its own
  // position via the drop handler).
  const draggingIdRef = { current: null as string | null };
  const ctx: ReorderContextValue = {
    notifyDragStart: (id) => { draggingIdRef.current = id; },
    notifyDrop: (id, targetIndex) => {
      if (id === draggingIdRef.current) return false;
      reorderDraggable(id, targetIndex);
      draggingIdRef.current = null;
      return true;
    },
    getOrder: () => order,
  };
  return (
    <ReorderContext.Provider value={ctx}>{children}</ReorderContext.Provider>
  );
}
