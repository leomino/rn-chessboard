import { memo } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useChessStore } from '../store/chessStore';
import { usePromotionStore } from '../store/promotionStore';
import { pieces, SQUARE_SIZE } from '../Constants';

export const PromotionModal = memo(() => {
  const chess = useChessStore((state) => state.chess);
  const modalOpen = usePromotionStore((state) => state.modalOpen);
  const closeModal = usePromotionStore((state) => state.closeModal);

  if (!modalOpen) return null;

  return (
    <Modal animationType="none" transparent={true} visible={modalOpen}>
      <View style={styles.main}>
        <View style={styles.row}>
          <Pressable onPress={() => closeModal('q')}>
            <Image
              style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }}
              source={pieces[`q${chess.turn()}`]}
            />
          </Pressable>
          <Pressable onPress={() => closeModal('n')}>
            <Image
              style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }}
              source={pieces[`n${chess.turn()}`]}
            />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable onPress={() => closeModal('b')}>
            <Image
              style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }}
              source={pieces[`b${chess.turn()}`]}
            />
          </Pressable>
          <Pressable onPress={() => closeModal('r')}>
            <Image
              style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }}
              source={pieces[`r${chess.turn()}`]}
            />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'row',
    padding: 12,
    gap: 16,
  },
  row: {
    display: 'flex',
    gap: 16,
  },
});
