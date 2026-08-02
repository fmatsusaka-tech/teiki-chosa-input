# 運用手順

## 環境変数

秘密値そのものをこの文書、GitHub Issue、PR、ログ、スクリーンショットへ記載しません。

| 変数 | 設定場所 | 用途 | 秘密 |
|---|---|---|---|
| `NODE_VERSION` | Render | Node.jsバージョン。現在は22 | いいえ |
| `PILOT_PASSWORD` | Render / `.env.local` | 少人数試用版の共通ログインパスワード | はい |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Render / `.env.local` | 保存・マスタ取得先スプレッドシート | 取扱注意 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Render / `.env.local` | Googleサービスアカウント | 取扱注意 |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Render / `.env.local` | Google API署名用秘密鍵 | はい |
| `OCR_MODE` | Render / `.env.local` | OCR運用モード。現在は`economy` | いいえ |
| `OCR_PROVIDER` | Render / `.env.local` | OCR Provider。現在は`paddle` | いいえ |
| `PADDLE_OCR_ENDPOINT` | Render / `.env.local` | OCR TunnelのHTTPS URL | 取扱注意 |
| `PADDLE_OCR_TOKEN` | Render / `.env.local` | RenderからOCRへ送るBearer Token | はい |
| `PADDLE_OCR_TIMEOUT_MS` | Render / `.env.local` | OCR通信タイムアウト。既定30000ms | いいえ |
| `OCR_GATEWAY_TOKEN` | 自宅PCの起動環境 | `PADDLE_OCR_TOKEN`と同じ値 | はい |
| `PADDLE_OCR_LANG` | 自宅PC（任意） | OCR言語。既定`japan` | いいえ |

`NEXT_PUBLIC_*`へ秘密値を設定しません。秘密値はサーバー側だけで参照します。

## 本番デプロイ

1. Issue専用ブランチからPRを作成する。
2. CIのtypecheck、lint、test、buildが成功したことを確認する。
3. PRをSquash and mergeする。
4. Renderが`main`の新コミットを自動デプロイする。
5. Render Eventsで対象コミットが`live`になったことを確認する。
6. `https://teiki-chosa-input.onrender.com/api/health`を開き、`app: ok`を確認する。
7. OCR運転中は`ocr: ok`、Google Sheetsへのテスト登録時は`調査原票`への追加を確認する。

Renderの初回構築は[Render無料枠への配置手順](docs/render-deployment.md)を参照してください。

## OCRの起動順

1. 自宅PCでPaddleOCRゲートウェイを`127.0.0.1:8765`に起動する。
2. 認証なしが401、正しいBearer Token付き`/health`が成功することを確認する。
3. Cloudflare Tunnelを起動する。
4. Quick Tunnelを使う場合、発行URLが変わるたびにRenderの`PADDLE_OCR_ENDPOINT`を更新して再デプロイする。
5. Inputの`/api/health`で`ocr: ok`を確認する。

詳細なコマンドとNamed Tunnel設定は[自宅PC OCRゲートウェイ運用手順](docs/remote-ocr-gateway.md)を参照してください。

## 外部サービスの設定場所

| サービス | 設定場所 |
|---|---|
| Render | `teiki-chosa-input` Web ServiceのEnvironment、Events、Logs、Settings |
| GitHub | `fmatsusaka-tech/teiki-chosa-input`のIssues、Pull requests、Actions |
| Google Sheets | 対象スプレッドシートの`調査原票`と`入力マスタ`、サービスアカウント共有設定 |
| Google Cloud | サービスアカウントとGoogle Sheets API |
| Cloudflare | Tunnel設定、Named Tunnel利用時のhostname/ingress |
| 自宅PC | PaddleOCR仮想環境、`OCR_GATEWAY_TOKEN`、cloudflaredプロセス |

## 調査データの有効・無効管理

- 対象: `定期調査データバンク`の`調査データ`タブ
- 正式見出し: `有効状態`
- 入力値: ドロップダウンの`有効`または`無効`
- 空欄、未知値、類似文字列: 分析へ採用しない
- `有効状態`が`有効`の場合だけ、既存の`データ状態`判定へ進む
- 無効行は削除せず、そのまま保持する

`調査データ`は自動生成されるため、元データを大量に追加・削除・並べ替えた後は、登録IDと
`有効状態`の対応を確認してください。ずれが疑われる場合はOutputでの利用を止め、変更前バックアップと
登録IDを照合して修復します。

## 障害時に確認する順番

### アプリが開かない

1. Render Eventsで最新デプロイが`live`か確認する。
2. Render Logsで起動エラーを確認する。
3. `/api/health`のHTTP状態を確認する。
4. `PILOT_PASSWORD`など必須環境変数が存在するか確認する。値は表示・共有しない。

### ログインできない

1. Renderの`PILOT_PASSWORD`設定有無を確認する。
2. ブラウザCookieを消して再ログインする。
3. パスワード変更直後ならRenderの再デプロイ完了を確認する。

### OCRだけ使えない

1. 自宅PCのPaddleOCRプロセスを確認する。
2. cloudflaredプロセスを確認する。
3. Tunnel URLとRenderの`PADDLE_OCR_ENDPOINT`が一致するか確認する。
4. `PADDLE_OCR_TOKEN`と`OCR_GATEWAY_TOKEN`が同じか確認する。値は記録しない。
5. Render Logsと自宅PC側ログを確認する。

OCR停止中もメモ入力とGoogle Sheets登録は利用できます。

### 保存できない

1. Render LogsでGoogle認証またはSheets APIエラーを確認する。
2. Googleサービスアカウントのメールと秘密鍵の設定有無を確認する。
3. 対象スプレッドシートがサービスアカウントへ共有されているか確認する。
4. `調査原票`の27見出しに不足・重複がないか確認する。
5. Google Sheets APIが有効か確認する。

## 復旧・切り戻し

- アプリの不具合: RenderのDeploysから直前の正常デプロイへRollbackする。
- 環境変数の誤設定: 正しい値へ戻し、再デプロイする。
- OCRの不具合: Tunnelとゲートウェイを停止する。Input本体は継続利用できる。
- 秘密漏えいの疑い: 対象トークン・パスワード・秘密鍵を直ちに再発行し、Renderと自宅PCを更新して再起動する。
- Google Sheetsの誤登録: 行を物理削除する前にバックアップを取り、データ状態による取消を優先する。
- `有効状態`の誤更新: Outputでの利用を停止し、変更前バックアップから登録IDごとの値を照合して戻す。

ロールバック後もGoogle Sheetsへ既に保存された行は自動では戻りません。アプリの切り戻しとデータ修正を分けて判断します。
