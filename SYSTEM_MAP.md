# システム構成図

## 対象範囲

このリポジトリはInput側です。調査データの入力、解析、確認、Google Sheetsへの正本保存までを担当します。比較、グラフ、気象連携、予測はOutput側の責務です。

## 構成

```text
利用者のスマートフォン／PC
  ├─ /login                 共通パスワード認証
  ├─ /                      メモ入力・画像選択・確認・登録
  └─ /ocr-review            OCR確認・編集
          │
          ▼
Render: Next.js Inputアプリ
  ├─ POST /api/pilot-login  ログインCookie発行
  ├─ GET  /api/health       アプリ・OCR稼働確認
  ├─ POST /api/ocr          画像検証、OCR、項目解析
  ├─ GET  /api/survey-masters 園地・品種候補取得
  └─ POST /api/survey-records 確認済みデータ保存
          │                         │
          │ HTTPS + Bearer Token    │ Google Sheets API
          ▼                         ▼
Cloudflare Tunnel             Googleスプレッドシート
          │                    ├─ 調査原票（唯一の正本）
          ▼                    ├─ 入力マスタ（園地・品種候補）
自宅PC PaddleOCR              └─ 補正ログ（解析改善用・保存失敗を妨げない）
  ├─ GET /health
  └─ POST /ocr
```

## 入力から保存まで

### メモ入力

1. 利用者が自由形式のメモを入力する。
2. ブラウザ内の入力画面がルールベースで候補レコードを作る。
3. 利用者が調査日、園地、品種、処理区、横径、糖度、酸度、備考を確認・修正する。
4. `POST /api/survey-records`がサーバー側で再検証する。
5. 登録IDと編集キーを生成し、編集キーのSHA-256ハッシュだけを`調査原票`へ追記する。
6. 平文編集キーは登録応答で一度だけ返し、保存しない。

### 画像入力

1. 利用者がJPEG、PNG、WebPの画像を選ぶ。
2. `POST /api/ocr`が形式と10MB上限を確認する。
3. RenderがBearer Token付きでCloudflare Tunnelへ送信する。
4. 自宅PCのPaddleOCRゲートウェイが一時ファイルで認識し、処理後に削除する。
5. 共通OCR結果をルールベースParserが調査候補へ変換する。
6. 利用者の確認後は、メモ入力と同じ保存経路を通る。

## 更新責務

| システム | 読み取るデータ | 更新するデータ |
|---|---|---|
| Input画面 | 入力中データ、API結果 | ブラウザ上の確認中データのみ |
| Input API | 確認済み入力、環境設定 | `調査原票`、補正ログ |
| PaddleOCR | 送信された画像 | 永続データなし。一時ファイルのみ |
| Google Sheets | `入力マスタ`、`調査原票`の見出し | Inputが`調査原票`へ追記 |
| Output側 | `調査原票` | Input正本を更新しない |

## 障害時の分離

- OCR停止時: 画像読取だけ停止し、メモ入力・確認・Google Sheets登録は継続できます。
- 入力マスタ取得失敗時: 組み込みの園地・品種候補を表示します。
- 補正ログ保存失敗時: 正本保存が成功していれば登録成功として扱います。
- Google Sheets保存失敗時: 登録は失敗し、利用者へ再試行可能なエラーを表示します。
