/** プレイ画面（仕様書 18.2）。 */
import { Suspense } from 'react'
import { PlayScreen } from './PlayScreen'

export default function SudokuPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            問題を準備しています…
          </p>
        </main>
      }
    >
      <PlayScreen />
    </Suspense>
  )
}
