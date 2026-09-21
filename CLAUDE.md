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

## 動作確認

```bash
npm run check   # 型チェック＋テスト
npm run dev     # http://localhost:3000
```
