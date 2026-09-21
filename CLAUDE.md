# sudoku-app 開発メモ

仕様書は `sudoku_app_spec_v0.1.md` に準拠。コード内のコメントは章番号で仕様書を参照している。

## 設計上の約束

- **AIを使わない。** ヒントは決定論的なルールベースで生成する。これがこのアプリの前提。
- **Solver と Hint Engine を混ぜない。** Solver は「解けるか・解答は何か」だけ。
  Hint Engine は「次の一手をどの論理で導くか」だけ。難易度判定は Hint Engine 側を使う。
- **ヒントは答えではなく推論情報を返す。** `explanation` と `steps` が無いヒントは作らない。
- **定石名は STEP 3 まで出さない。** 先に名前が見えると考える余地がなくなる。

## 内部表現

候補はビットマスク（bit0 = 数字1 … bit8 = 数字9）で持つ。
`candidateEngine.ts` の `maskToNumbers` / `numbersToMask` / `popCount` で変換する。
UIに渡すときだけ数字の配列に直す。

## ヒントルールの追加手順

1. `hints/types.ts` の `TechniqueId` と `TECHNIQUES` に追加（`weight` が難易度判定に直結する）
2. `hints/<name>.ts` にルールを実装。`util.ts` の `makeHint` を使う
3. `hintEngine.ts` の `RULES` に、やさしい順の正しい位置へ挿入
4. `npm run gen:test-puzzles` で固定問題を生成
5. `npm test` で検証

サブセット系（Pair / Triple）は `hints/subsets.ts` の
`makeNakedSubsetRule` / `makeHiddenSubsetRule` を再利用する。

## 消去済み候補の扱い

ヒントで消した候補は `GameState.eliminated` に持つ。
**数字を確定・消去したときは `eliminated` をリセットする**（`gameState.ts`）。
盤面が変わると消去の根拠が現在の盤面と食い違う可能性があるため。
数字を置かない限りは消去が積み上がるので、Locked Candidates → Naked Pair → …
と定石を連鎖させて学べる。

## 問題生成の性質

削り切った問題の難易度はほぼ運で決まる。特に Hard 帯
（最難が Hidden Pair / Triple 系）に落ちるのは 2 割程度しかない。
そのため `generatePuzzle` は試行回数を多め（既定150回）に取り、
時間予算（既定8秒）で打ち切る。**この試行回数を安易に減らすと
Hard / Expert の生成が確率的に失敗するようになる。**

`minGivens` は「そこで削るのをやめる目安」であって下限ではない。
目標難易度に届いていなければ `ABSOLUTE_MIN_GIVENS` まで削り続ける。

## 入力方式

`inputStyle` が 'cell'（マス優先）と 'digit'（数字優先）の2通りある。
盤面のタップは必ず `tapCell` アクションを通し、どちらの方式かは reducer 側で判断する。
コンポーネント側で分岐させないこと。`mode`（数字 / メモ）は入力方式と直交する。

## テーマ

現在のテーマは `<html data-theme>` が持つ。初期値は `layout.tsx` のインラインスクリプトが
**描画前に**入れる（これが無いとダーク設定の端末で一瞬ライトが見える）。
React 側は `useSyncExternalStore` で読むだけ。`useEffect` で setState してはいけない
（`react-hooks/set-state-in-effect` で lint エラーになる）。

CSS の配色はライトを `:root`、ダークを `:root[data-theme="dark"]` に書く。
メディアクエリでの二重定義はしない。

## レイアウトの制約

スマホ縦（375×812）では**全体が1画面に収まること**が条件。
要素を足すときは実測して確認する。

```js
// ブラウザのコンソールで
document.body.scrollHeight - innerHeight  // 0以下であること
```

盤面の大きさはスマホでは横幅で決まるため、縦の余りを盤面に回すことはできない。
余った縦は操作ボタンのタップ領域に使う。

## プレイ記録

記録の目的は「何問解いたか」ではなく **どの定石が苦手か** を本人に見せること。
そのため `GameRecord` には必ず

- `requiredTechniques`（その問題に必要だった定石）
- `hintTechniques`（実際にヒントに頼った定石と回数）

の両方を残す。片方だけでは習熟度が出せない。

ミス回数は `puzzle.solution` と照らして数える（重複ではなく「解答と違う数字を置いた回数」）。
**Undo してもミス回数は減らさない** — 間違えた事実は変わらないため。

### localStorage の読み取り

`useEffect` で setState してはいけない（lint エラー）。`useSyncExternalStore` を使う。
その際 **getServerSnapshot は必ず同じ参照を返すこと**。
毎回 `[]` を新しく作ると「infinite loop」の警告が出る（`EMPTY_RECORDS` を使い回している）。

## デイリー数独

日付から決定的に選ぶ（サーバーを持たないため）。`dailyPuzzle(key)` は
同じ日付なら必ず同じ問題を返す。難易度は曜日で決まる。
**事前生成プールを作り直すと、過去日付の問題も変わる**点に注意。

## 動作確認

```bash
npm run check   # 型チェック＋テスト
npm run dev     # http://localhost:3000
```
