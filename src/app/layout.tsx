import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sudoku - 解き方を教える数独',
  description:
    '答えではなく「なぜその数字になるのか」を定石に基づいて説明する、広告なし・無料の数独アプリ。',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/**
 * 描画前にテーマを確定させる。
 * これが無いと、ダーク設定の端末で一瞬ライトの背景が出る。
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('sudoku:theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/*
          テーマは描画前に確定させたいので、head でそのまま実行する。
          next/script の beforeInteractive は body の先頭に置かれるため、
          ダーク設定の端末で一瞬ライトが見える可能性がある。
          React は「クライアント描画では実行されない」と開発時に助言を出すが、
          この処理は最初の1回だけ動けばよいので問題ない。
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
