'use client'

/**
 * ブロック完成の演出（画面側）。
 * 完成したブロックの真ん中から星が弾け、「ブロック完成」の札が浮かんで消える。
 *
 * マス自体が光る演出は SudokuCell の .cell-celebrate が担当し、
 * ここはその上に重ねる飾りだけを受け持つ。操作の邪魔をしないよう
 * pointer-events は切ってある。
 */

/** 弾ける星の数と飛ぶ距離（ブロックの大きさに対する割合） */
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  angle: (360 / 10) * i + (i % 2 === 0 ? 0 : 12),
  distance: i % 2 === 0 ? 62 : 44,
  glyph: i % 3 === 0 ? '✦' : '•',
}))

export function BlockCelebration({ block }: { block: number }) {
  const row = Math.floor(block / 3)
  const col = block % 3

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute"
      style={{
        left: `${(col * 100) / 3}%`,
        top: `${(row * 100) / 3}%`,
        width: `${100 / 3}%`,
        height: `${100 / 3}%`,
        zIndex: 5,
        // 星の飛距離をブロックの大きさ基準（cqmin）で指定するため
        containerType: 'size',
      }}
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="celebrate-particle absolute leading-none"
          style={
            {
              left: '50%',
              top: '50%',
              color: 'var(--celebrate-ink)',
              fontSize: p.glyph === '✦' ? '0.95rem' : '0.7rem',
              '--angle': `${p.angle}deg`,
              '--distance': `${p.distance}cqmin`,
              animationDelay: `${120 + (i % 3) * 30}ms`,
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}

      <span
        className="celebrate-badge absolute whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
        style={{
          left: '50%',
          top: '50%',
          color: 'var(--celebrate-ink)',
          background: 'var(--surface)',
          boxShadow: '0 0 0 2px var(--celebrate), var(--shadow)',
        }}
      >
        ✨ ブロック完成
      </span>
    </div>
  )
}
