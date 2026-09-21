'use client'

/** 効果音のオン・オフ。設定は localStorage に持つ */
import { useCallback, useSyncExternalStore } from 'react'
import {
  isSoundEnabled,
  isSoundEnabledServer,
  playSound,
  setSoundEnabled,
  subscribeSound,
} from './sounds'

export const useSound = () => {
  const soundEnabled = useSyncExternalStore(
    subscribeSound,
    isSoundEnabled,
    isSoundEnabledServer,
  )

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    // 切り替えた手応えとして、オンにした瞬間だけ鳴らす
    if (next) playSound('place')
  }, [])

  return { soundEnabled, toggleSound }
}
