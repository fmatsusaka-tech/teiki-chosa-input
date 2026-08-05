# HANDOFF

このファイルは、全体監査・改修作業（2026-08-05開始）の引継ぎ記録です。各Issue完了時に追記します。

## バックアップ地点

- タグ: `backup/pre-audit-20260805-121655`
- コミットSHA: `caf8307c2452b2fe2c34062f63069a22eb1e8176`（監査開始時点の`main`）

## 監査で判明した既存の並行作業（触れていません）

- Issue #39（調査データへ有効状態を追加）: Draft PR #40が既に存在し、実スプレッドシートへ列追加済み。`main`とconflicting。別セッション（Codex）の作業のため今回は触れていません。
- Issue #41（園地別処理区候補・自由記入）: Draft PR #42が既に存在。`main`とconflicting。同上の理由で触れていません。

## 対応履歴

### Issue #55（Critical）→ PR #61 → マージ済み
- 内容: `POST /api/survey-records`が`GOOGLE_SHEETS_SPREADSHEET_ID`未設定時に本番スプレッドシートIDへ暗黙フォールバックする問題を修正。`.env.example`の実IDもプレースホルダー化。
- レビュー: 独立レビュー実施（LOW指摘1件→対応済み）。
- 検証: typecheck/lint/test(126件)/build 全成功。

### Issue #57（Medium）→ PR #63 → マージ済み
- 内容: OCR経由登録で`measuredDate`が`null`のとき、サーバーが登録時刻へ仮設定し警告を追加するよう修正（従来は例外→不可解な503）。
- レビュー: Standardリスクのため自己レビュー＋CIのみ。
- 検証: typecheck/lint/test(126件)/build 全成功。

### Issue #58（Medium）→ PR #64 → マージ済み
- 内容: 常時失敗していた`.github/workflows/nextjs.yml`（GitHub Pagesデプロイ）を削除。本番運用はRenderのみで影響なし。
- レビュー: Lowリスクのため自己確認＋CIのみ。

### Issue #56（High）→ PR #62 → マージ済み
- 内容: `GoogleSheetsRestClient.getRows()`の列範囲固定（`!A:E`）を解消し、`GoogleSheetsRestClient`の単体テストを新規追加。
- レビュー指摘（MEDIUM）: `GUARANTEES.md`が「5列超・並べ替えでも解決できる」ことを`sheet-survey-masters.test.ts`で確認済みと記載していたが、実際には該当テストが無かった。`buildSurveyMasterCatalog`経由の統合テストを追加して解消。
- 検証: typecheck/lint/test(137件)/build 全成功。

### Issue #54（Critical）→ PR #67 → マージ済み
- 内容: 園地・品種・処理区・計測日・横径(順不同)・糖度・酸度が完全に一致する「有効」行がある場合、登録をブロックする重複防止を実装。一括登録の一部だけ重複する場合は重複分だけ弾き、全件重複時はアラート表示に変える。
- レビュー指摘（HIGH）: 計測日の重複判定が書込み時のゼロパディング済み文字列との完全一致に依存しており、Google Sheetsが読み戻す際の表示フォーマット差異（ゼロパディングなし等）で実運用の重複検知が機能しない恐れがあった。文字列比較から絶対時刻(epoch ms)比較へ変更し、ゼロパディングなしケース・レガシーISO 8601形式ケースの両方をテストで確認して解消。
- 検証: typecheck/lint/test(143件)/build 全成功。

### Issue #59（Medium）→ PR #68 → マージ済み
- 内容: `POST /api/pilot-login`へブルートフォース対策のレート制限（連続5回失敗で5分ロックアウト）を追加。
- レビュー指摘（HIGH）: レート制限チェックの後に`await request.json()`を挟んでいたため、並行リクエストで全リクエストがロック未設定状態を読み取ってしまい、上限を超えて多重に推測できてしまう問題があった。`request.json()`を先に解決させ、チェックから失敗記録までを完全に同期区間にすることで解消。並行8件中5件のみ401・残り3件が429になることを回帰テストで確認（修正前は8件全てが401になることも確認済み）。
- テスト追加に伴い、`@/`エイリアスがvitestで未解決だった問題も解消（`vitest.config.ts`新設）。
- 検証: typecheck/lint/test(145件)/build 全成功。

### Issue #60（Low）→ PR #69 → マージ済み
- 内容: `eslint.config.mjs`の`import/no-anonymous-default-export`警告を解消。
- レビュー: Lowリスクのため自己確認＋CIのみ。

### Issue #65（Low・本ファイル自体の新設）→ PR #66 → マージ済み

## 最終状態（2026-08-05）

- 発見Issue: Critical 2件・High 1件・Medium 3件・Low 2件、計8件（すべて対応・マージ・クローズ済み）
- 既存の並行作業（Issue #39/#41、Draft PR #40/#42）には触れていない
- 最終検証（`main`、コミット後）: typecheck成功、lint警告0件、test 27ファイル/151件成功、build成功
- 作成したバックアップ: タグ`backup/pre-audit-20260805-121655`（コミット`caf8307`）
- マージ済みPR: #61, #62, #63, #64, #66, #67, #68, #69（すべてSquash and merge、作業ブランチ削除済み）

## 復旧方法

いずれのPRも`Squash and merge`でマージ済みです。問題が見つかった場合は該当PRのSquashコミットを`git revert`すれば個別に戻せます。データ移行や不可逆操作は含まれていません。
