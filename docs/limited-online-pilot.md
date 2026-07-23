# 限定オンライン試用版の運用

関連Issue: [#3](https://github.com/fmatsusaka-tech/teiki-chosa-input/issues/3)

## 構成

自宅PC上でNext.jsとPaddleOCRを動かし、Cloudflare Quick TunnelからHTTPSで公開します。
自宅ルーターの受信ポートは開放しません。Quick Tunnelは試験・開発用途であり、URLの継続性や
稼働率は保証されません。

## 秘密情報

`.env.local`へ次を設定します。値はGitHub、チャット、スクリーンショットへ貼り付けません。

```dotenv
PILOT_USERNAME=試用者へ伝えるユーザー名
PILOT_PASSWORD=十分に長い共有パスワード
GOOGLE_SHEETS_SPREADSHEET_ID=開発用SpreadsheetのID
GOOGLE_SERVICE_ACCOUNT_EMAIL=サービスアカウント
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OCR_MODE=economy
OCR_PROVIDER=paddle
PADDLE_OCR_ENDPOINT=http://127.0.0.1:8765
```

本番ビルドでは共有認証が未設定の場合、アプリは外部公開せず`503`を返します。

## 起動順

1. PaddleOCRを`127.0.0.1:8765`で起動する。
2. `npm.cmd run build`を実行する。
3. `npm.cmd run start:pilot`でアプリを`127.0.0.1:3002`へ起動する。
4. `http://127.0.0.1:3002/api/health`を認証付きで開き、`app`と`ocr`が`ok`であることを確認する。
5. `.\.tools\cloudflared.exe tunnel --url http://127.0.0.1:3002`を起動する。
6. 表示された`https://*.trycloudflare.com`のURLと共有認証情報を試用者へ別々に伝える。

## 停止

Cloudflare Tunnelを先に停止し、その後Next.jsとPaddleOCRを停止します。URLを無効にしたい場合も
Tunnelを停止します。

## 試用者へ伝える注意

- URLは試用中に変わる可能性があります。
- JPEG、PNG、WebPの10MB以下の画像を使用します。
- 認識結果を必ず人が確認してから登録します。
- 認証情報を第三者へ転送しません。
- 個人情報を含む画像を投入しません。
