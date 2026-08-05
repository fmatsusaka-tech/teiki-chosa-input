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

### Issue #56（High）→ PR #62 → 独立レビュー済み（MEDIUM指摘1件を反映しマージ待ち）
- 内容: `GoogleSheetsRestClient.getRows()`の列範囲固定（`!A:E`）を解消し、`GoogleSheetsRestClient`の単体テストを新規追加。
- レビュー指摘（MEDIUM）: `GUARANTEES.md`が「5列超・並べ替えでも解決できる」ことを`sheet-survey-masters.test.ts`で確認済みと記載していたが、実際には該当テストが無かった。`buildSurveyMasterCatalog`経由の統合テストを追加して解消。
- 検証: typecheck/lint/test(137件)/build 全成功。

## 次に着手するIssue

- Issue #54（Critical・重複データ登録防止）: Issue #56のマージ後に着手（`調査原票`の全列読み取りに`getRows`の修正が必要なため）。
- Issue #59（Medium・pilot-loginレート制限）
- Issue #60（Low・eslint警告解消）

## 復旧方法

いずれのPRも`Squash and merge`でマージし、`git revert <squashコミット>`で個別に戻せます。データ移行や不可逆操作は含まれていません。
