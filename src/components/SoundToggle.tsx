'use client'

/** 効果音のオン・オフ */
import { useSound } from '@/features/audio/useSound'

export function SoundToggle({ className = '' }: { className?: string }) {
  const { soundEnabled, toggleSound } = useSound()

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={soundEnabled}
      aria-label={soundEnabled ? '効果音を消す' : '効果音を鳴らす'}
      title={soundEnabled ? '効果音オン' : '効果音オフ'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-base ${className}`}
      style={{
        borderColor: 'var(--line)',
        background: 'var(--surface)',
        opacity: soundEnabled ? 1 : 0.55,
      }}
    >
      {soundEnabled ? '🔊' : '🔇'}
    </button>
  )
}
