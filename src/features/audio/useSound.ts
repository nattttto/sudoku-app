'use client'

/** 効果音のオン・オフと音量。設定は localStorage に持つ */
import { useCallback, useSyncExternalStore } from 'react'
import {
  getVolume,
  getVolumeServer,
  isSoundEnabled,
  isSoundEnabledServer,
  playSound,
  setSoundEnabled,
  setVolume,
  subscribeSound,
} from './sounds'

export const useSound = () => {
  const soundEnabled = useSyncExternalStore(
    subscribeSound,
    isSoundEnabled,
    isSoundEnabledServer,
  )
  const volume = useSyncExternalStore(subscribeSound, getVolume, getVolumeServer)

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    // 切り替えた手応えとして、オンにした瞬間だけ鳴らす
    if (next) playSound('place')
  }, [])

  const changeVolume = useCallback((next: number) => setVolume(next), [])

  /** 音量を決めたあとに、その大きさで1回鳴らして確かめられるようにする */
  const previewVolume = useCallback(() => playSound('place'), [])

  return { soundEnabled, toggleSound, volume, changeVolume, previewVolume }
}
