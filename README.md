# 定期調査入力システム（Input）

まつさか農園の柑橘定期調査データを、スマートフォンから入力・確認し、Googleスプレッドシートの正本へ保存するシステムです。このリポジトリは入力側だけを扱い、比較・分析・予測などのOutput側機能は扱いません。

## 利用者

- 主な利用者: まつさか農園で定期調査を入力する担当者
- 運用担当者: Render、Google Sheets、自宅PCのOCR接続を管理する担当者
- 開発担当者: GitHub Issue単位で保守する人またはAIエージェント

## 主要機能

- 自由形式のメモを解析し、複数の調査レコードへ分割
- 画像（JPEG、PNG、WebP、最大10MB）をPaddleOCRで読み取り
- 登録前に園地、品種、処理区、調査日、横径、糖度、酸度、備考を確認・修正
- 園地・品種マスタをGoogle Sheetsから取得し、取得できない場合は組み込み候補へフォールバック
- 確認済みデータをGoogle Sheetsの`調査原票`へ一括登録
- 少人数試用向けの共通パスワード認証
- アプリ本体とOCRの稼働状態を`/api/health`で確認
- `調査データ`の`有効状態`を人が調整し、分析への採否を明示

## 現在の完成状況

| 機能 | 状況 | 補足 |
|---|---|---|
| 自由メモの解析・確認・登録 | 完成 | 本番利用可能 |
| Google Sheetsへの正本保存 | 完成 | 27列契約。見出し名で列を解決 |
| 園地・品種マスタ取得 | 完成 | 障害時は組み込み候補を使用 |
| 画像OCR | 完成 | RenderからCloudflare Tunnel経由で自宅PCのPaddleOCRへ接続 |
| 共通パスワード認証 | 完成 | 少人数試用向け |
| 調査データの有効・無効管理 | 完成 | `調査データ`上で人が調整。空欄は不採用 |
| 履歴表示・既存行の編集 | 未完成 | 編集キーの保存基盤のみ実装済み |
| 比較・グラフ・気象・予測 | 未完成 | Output側の範囲 |
| 音声・PDFの直接取込 | 未完成 | 将来候補 |

## データ上の重要事項

- 正本はGoogleスプレッドシートの`調査原票`です。
- 必須項目は調査日、園地、品種に加え、現在の新規登録では横径1〜10個と糖度が必要です。
- 酸度、処理区、備考は未入力でも登録できます。
- 未測定の数値を`0`で代用せず、空欄または`null`として扱います。
- AI/OCR結果は自動保存せず、利用者の確認後に登録します。
- Outputへ渡す`調査データ`は、`有効状態`が`有効`の行だけを採用候補とします。

詳しい列仕様は[Input正本データ辞書](docs/input-data-dictionary.md)、全体構成は[SYSTEM_MAP.md](SYSTEM_MAP.md)、維持すべき動作は[GUARANTEES.md](GUARANTEES.md)を参照してください。

## ローカル起動

前提: Node.js 22、npm、Google Sheets用サービスアカウント設定。画像OCRも使う場合はPython環境とPaddleOCRゲートウェイが必要です。

```powershell
cd C:\Dev\teiki-chosa-input
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000`を開きます。秘密情報は`.env.local`に設定し、Gitへ登録しません。

確認コマンド:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## 公開方法

本番はGitHubの`main`をRenderへ自動デプロイします。RenderのBlueprint設定は`render.yaml`にあります。秘密値はRender DashboardのEnvironmentで設定します。

- 本番URL: `https://teiki-chosa-input.onrender.com`
- OCR: Render → HTTPS/Bearer Token → Cloudflare Tunnel → 自宅PC PaddleOCR
- 保存先: Google Sheets API → `調査原票`

具体的な環境変数、デプロイ、障害対応、切り戻しは[OPERATIONS.md](OPERATIONS.md)を参照してください。

## 開発ルール

- 対象リポジトリ: `fmatsusaka-tech/teiki-chosa-input`
- 1 Issue = 1 PRを基本とし、`main`へ直接コミットしません。
- 実装変更時は、このREADME、`SYSTEM_MAP.md`、`GUARANTEES.md`、`OPERATIONS.md`が古くならないか確認します。
- 詳細は[AGENTS.md](AGENTS.md)を参照してください。
