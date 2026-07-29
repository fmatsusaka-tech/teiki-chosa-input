# Render無料枠へのInput本体の配置

関連Issue: [#7](https://github.com/fmatsusaka-tech/teiki-chosa-input/issues/7)

## この配置で利用できる機能

- 共通パスワードによるログイン
- メモ文章の貼り付けと解析
- 読み取り結果の人による補正
- 開発用Googleスプレッドシートへの保存

自宅PCのOCR接続が完成するまでは、画像認識のみ利用できません。OCRが停止中でも、
アプリのヘルスチェックは成功し、文章入力と保存を継続できます。

## Renderでの作成

1. RenderへGitHubアカウントでログインする。
2. `New`から`Blueprint`を選択する。
3. `fmatsusaka-tech/teiki-chosa-input`を選択する。
4. ルートの`render.yaml`を使用して無料Web Serviceを作成する。
5. 初回作成画面で、次の秘密環境変数を入力する。

| 環境変数 | 内容 |
| --- | --- |
| `PILOT_PASSWORD` | 試用者へ共有するログインパスワード |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | 開発用スプレッドシートID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Googleサービスアカウントのメール |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Googleサービスアカウントの秘密鍵 |
| `PADDLE_OCR_ENDPOINT` | 自宅PC OCR TunnelのHTTPS URL |
| `PADDLE_OCR_TOKEN` | PC側と共有するOCR専用秘密トークン |

秘密鍵は`.env.local`の値と同じく、BEGIN/END行を含む全文を設定します。これらの値は
GitHub、Issue、PR、チャット、スクリーンショットへ貼り付けません。

## 動作確認

1. Renderのデプロイが`Live`になるまで待つ。
2. 発行された`https://...onrender.com`を開く。
3. 共通パスワードでログインする。
4. テスト用メモを文章入力して補正画面を確認する。
5. 備考へ`Render接続テスト`と入力して開発用調査原票へ保存する。
6. Googleスプレッドシートに1行追加されたことを確認する。

`/api/health/`は、アプリ本体が正常ならHTTP 200を返します。レスポンスの`ocr`が
`unavailable`でも、Issue #8が完了するまでは正常な状態です。

## 無料枠の注意

一定時間アクセスがないと休止し、次のアクセス時には起動まで待ち時間が発生します。
ローカルファイルは永続保存されないため、観測データは従来どおりGoogleスプレッドシート
だけへ保存します。

## 停止とロールバック

- 一時停止はRender DashboardでWeb ServiceをSuspendする。
- 問題がある版はRender DashboardのDeploysから直前の正常版へRollbackする。
- 秘密情報が漏れた可能性がある場合は、該当する値を直ちに再発行・変更する。
