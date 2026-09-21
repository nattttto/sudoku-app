'use client'

/**
 * リスタート。取り返しがつかないので2段階で確認する。
 * 盤面下の情報行に小さく置き、誤って押しにくい位置と大きさにしている。
 */
import { useEffect, useState } from 'react'

export function RestartButton({ onRestart }: { onRestart: () => void }) {
  const [confirming, setConfirming] = useState(false)

  // 確認したまま放置されないよう、少し経ったら元に戻す
  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 5000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded px-1 underline-offset-2 hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        ⟲ 最初から
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span style={{ color: 'var(--danger)' }}>消して最初から？</span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false)
          onRestart()
        }}
        className="rounded border px-1.5 py-0.5"
        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
      >
        はい
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded border px-1.5 py-0.5"
        style={{ borderColor: 'var(--line)' }}
      >
        やめる
      </button>
    </span>
  )
}
