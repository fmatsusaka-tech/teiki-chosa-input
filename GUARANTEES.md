# 維持すべき保証

この文書は、変更後も必ず維持する動作・業務ルール・セキュリティ条件をまとめたものです。仕様変更が必要な場合は、先にGitHub Issueで合意し、関連テストと文書を同時に更新します。

## 業務・データ保証

| 保証 | 確認方法 |
|---|---|
| AI/OCRの候補を自動保存せず、利用者の確認後だけ登録する | 入力画面と`POST /api/survey-records`の経路確認、画面実動確認 |
| 調査日、園地、品種を空のまま保存しない | `survey-record`、確認画面、保存テスト |
| 新規登録では横径1〜10個と糖度を要求する | `save-survey-records.test.ts`、画面テスト |
| 酸度、処理区、備考は欠測を許可する | ドメイン・保存テスト |
| 未測定数値を`0`へ変換せず、`null`またはシート空欄にする | `google-sheets-persistence.test.ts`、実シート確認 |
| `調査原票`の公開済み27列を改名・削除・並べ替え前提にしない | `docs/input-data-dictionary.md`、見出し解決テスト |
| 派生値、予測値、AIコメントを正本へ保存しない | 保存行テストと正本データ辞書の確認 |
| Output側はInputの正本へ書き戻さない | システム間契約とOutput側実装の確認 |
| `有効状態`は`有効`・`無効`だけを許可し、空欄・未知値・非文字列を不採用にする | `apps-script/Code.test.ts` |
| 採用判定は先に`有効状態 = 有効`、次に目的別の`データ状態`を確認する | `apps-script/Code.test.ts` |
| 無効行・欠測値・元行を削除または0変換しない | Apps Scriptテスト、Spreadsheet変更前後件数確認 |
| 手動再生成時は登録IDに紐づく有効状態を保持する | `apps-script/Code.test.ts` |

## 障害時の保証

| 保証 | 確認方法 |
|---|---|
| OCRが停止してもアプリ全体を起動不能にしない | OCR停止状態で`/api/health`がHTTP 200かつ`ocr: unavailable`、メモ入力確認 |
| 入力マスタ取得失敗時も組み込み候補を返す | `sheet-survey-masters.test.ts`、API応答確認 |
| 補正ログの失敗で正本保存を失敗扱いにしない | `correction-log.test.ts`とAPI実装確認 |
| 保存失敗時に成功表示をしない | 保存サービス・APIテスト |

## セキュリティ保証

| 保証 | 確認方法 |
|---|---|
| 秘密情報をGit、画面、通常ログへ記録しない | `git diff`、`.gitignore`、Render設定確認 |
| 本番で`PILOT_PASSWORD`未設定なら503とし、無認証公開しない | `pilot-auth.test.ts`、本番相当環境で確認 |
| 認証CookieはHttpOnly、SameSite=Lax、本番Secure | `src/app/api/pilot-login/route.ts`とテスト確認 |
| OCRゲートウェイはBearer Tokenを必須にする | `sidecars/paddleocr/test_app.py`で401/成功を確認 |
| リモートOCR接続はHTTPSだけを許可する | `paddle-ocr-provider.test.ts` |
| OCR画像はJPEG/PNG/WebP、10MB以下だけを許可する | `image-input-validation.test.ts`とPythonテスト |
| OCR画像と結果を自宅PCへ永続保存しない | ゲートウェイ実装確認。一時ファイルが処理終了時に消えることを確認 |
| 平文編集キーを正本やログへ保存しない | `edit-key.test.ts`、保存テスト、実シート確認 |

## 標準確認コマンド

```powershell
npm run typecheck
npm run lint
npm test
npm run build
.\.venv-paddleocr\Scripts\python.exe -m pytest sidecars\paddleocr\test_app.py
```

Python環境がない場合は、未実行理由をPR本文へ記載します。公開後は`/api/health`で`app: ok`を確認し、OCR運転中は`ocr: ok`も確認します。
