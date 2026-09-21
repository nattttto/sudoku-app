'use client'

/**
 * ブロック・行・列の完成演出（画面側）。
 *
 * - ブロック：中央から星が弾ける
 * - 行・列  ：各マスの上で小さなきらめきが、完成マスから順に弾ける
 * - 札      ：「ブロック・行 完成」のように、何が揃ったかを1枚で出して浮かべて消す
 *
 * マス自体が光る演出は SudokuCell の .cell-celebrate が担当し、
 * ここはその上に重ねる飾りだけを受け持つ。操作の邪魔をしないよう
 * pointer-events は切ってある。
 */
import { colOf, rowOf } from '@/features/sudoku/board/board'
import type { Unit } from '@/features/sudoku/board/types'

/** ブロックで弾ける星の数と飛ぶ距離（ブロックの大きさに対する割合） */
const BURST = Array.from({ length: 10 }, (_, i) => ({
  angle: (360 / 10) * i + (i % 2 === 0 ? 0 : 12),
  distance: i % 2 === 0 ? 62 : 44,
  glyph: i % 3 === 0 ? '✦' : '•',
}))

const UNIT_LABEL: Record<Unit['type'], string> = {
  box: 'ブロック',
  row: '行',
  col: '列',
}

/** 波の間隔。SudokuBoard のマスの光り方と揃える */
const WAVE_STEP_MS = 70

const CELL = 100 / 9
const BOX = 100 / 3

/** ユニットが盤面のどこを占めるか（%） */
const areaOf = (unit: Unit) => {
  if (unit.type === 'box') {
    return {
      left: (unit.index % 3) * BOX,
      top: Math.floor(unit.index / 3) * BOX,
      width: BOX,
      height: BOX,
    }
  }
  if (unit.type === 'row') return { left: 0, top: unit.index * CELL, width: 100, height: CELL }
  return { left: unit.index * CELL, top: 0, width: CELL, height: 100 }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function UnitCelebration({ units, origin }: { units: Unit[]; origin: number }) {
  const originRow = rowOf(origin)
  const originCol = colOf(origin)

  // 札はブロックがあればその中央、無ければ最後に置いたマスの近くに出す。
  // 盤面の端で切れないよう、位置は内側に寄せる
  const main = units[0]
  const badgeX =
    main.type === 'col'
      ? clamp(main.index * CELL + CELL / 2, 20, 80)
      : main.type === 'box'
        ? clamp(areaOf(main).left + BOX / 2, 20, 80)
        : clamp(originCol * CELL + CELL / 2, 20, 80)
  const badgeY =
    main.type === 'row'
      ? clamp(main.index * CELL + CELL / 2, 14, 92)
      : main.type === 'box'
        ? clamp(areaOf(main).top + BOX / 2, 14, 92)
        : clamp(originRow * CELL + CELL / 2, 14, 92)

  const label = units.map((unit) => UNIT_LABEL[unit.type]).join('・')

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }} aria-live="polite">
      {units.map((unit) => {
        const area = areaOf(unit)
        const key = `${unit.type}${unit.index}`

        if (unit.type === 'box') {
          return (
            <div
              key={key}
              className="absolute"
              style={{
                left: `${area.left}%`,
                top: `${area.top}%`,
                width: `${area.width}%`,
                height: `${area.height}%`,
                // 星の飛距離をブロックの大きさ基準（cqmin）で指定するため
                containerType: 'size',
              }}
            >
              {BURST.map((p, i) => (
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
            </div>
          )
        }

        // 行・列は、並んだ9マスの上でそれぞれきらめかせる
        return Array.from({ length: 9 }, (_, i) => {
          const row = unit.type === 'row' ? unit.index : i
          const col = unit.type === 'row' ? i : unit.index
          const distance = Math.max(Math.abs(row - originRow), Math.abs(col - originCol))
          return (
            <span
              key={`${key}-${i}`}
              aria-hidden
              className="celebrate-sparkle absolute leading-none"
              style={{
                left: `${col * CELL + CELL / 2}%`,
                top: `${row * CELL + CELL / 2}%`,
                color: 'var(--celebrate-ink)',
                fontSize: '0.9rem',
                animationDelay: `${distance * WAVE_STEP_MS + 80}ms`,
              }}
            >
              ✦
            </span>
          )
        })
      })}

      <span
        className="celebrate-badge absolute whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
        style={{
          left: `${badgeX}%`,
          top: `${badgeY}%`,
          color: 'var(--celebrate-ink)',
          background: 'var(--surface)',
          boxShadow: '0 0 0 2px var(--celebrate), var(--shadow)',
        }}
      >
        ✨ {label} 完成{units.length >= 2 ? '！' : ''}
      </span>
    </div>
  )
}
