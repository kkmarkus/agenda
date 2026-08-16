import { useCallback, useRef } from 'react';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

// Guarda uma ref por card pra poder fechar o swipe (deslizar pra revelar
// ações) de um item quando outro é aberto, ou fechar manualmente após uma ação.
export function useSwipeableRefs() {
  const swipeableRefs = useRef<Record<number, SwipeableMethods | null>>({});

  const registrarSwipeableRef = useCallback((id: number, ref: SwipeableMethods | null) => {
    swipeableRefs.current[id] = ref;
  }, []);

  function fecharOutrosSwipes(idAtual: number) {
    Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
      if (Number(id) !== idAtual && ref) ref.close();
    });
  }
  const onSwipeableWillOpen = useCallback((idAtual: number) => fecharOutrosSwipes(idAtual), []);

  function fecharSwipeDoItem(id: number) {
    swipeableRefs.current[id]?.close();
  }

  return { registrarSwipeableRef, onSwipeableWillOpen, fecharSwipeDoItem };
}
