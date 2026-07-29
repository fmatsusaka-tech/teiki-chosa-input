# 自宅PC OCRゲートウェイ運用手順

関連Issue: [#8](https://github.com/fmatsusaka-tech/teiki-chosa-input/issues/8)

## 構成

```text
Render上のInput
  └─ HTTPS + Bearer Token
       └─ Cloudflare Tunnel
            └─ 127.0.0.1:8765 のPaddleOCRゲートウェイ
```

自宅ルーターのポート開放は行わない。Tunnelの転送先はOCRゲートウェイだけに限定し、
Input本体、ファイル共有、リモートデスクトップなどへ接続しない。

## 秘密トークン

十分に長いランダム値を1つ生成し、次の2か所へ同じ値を設定する。

- Render: `PADDLE_OCR_TOKEN`
- 自宅PCの起動用PowerShell: `OCR_GATEWAY_TOKEN`

値はGitHub、Issue、PR、チャット、ログ、スクリーンショットへ貼り付けない。漏えいの
可能性がある場合は新しい値へ交換し、RenderとPCを再起動する。

## PC側の起動

```powershell
cd C:\Dev\teiki-chosa-input
.\.venv-paddleocr\Scripts\Activate.ps1
$env:OCR_GATEWAY_TOKEN = "<RenderのPADDLE_OCR_TOKENと同じ値>"
python -m uvicorn app:app --app-dir sidecars/paddleocr --host 127.0.0.1 --port 8765
```

別のPowerShellから、認証なしの要求が`401`、認証付き要求だけが成功することを確認する。

```powershell
Invoke-WebRequest http://127.0.0.1:8765/health -SkipHttpErrorCheck
$headers = @{ Authorization = "Bearer <秘密トークン>" }
Invoke-RestMethod http://127.0.0.1:8765/health -Headers $headers
```

## ドメインなしで一時試験する場合

Cloudflare管理ドメインがない場合はQuick Tunnelで疎通確認できる。

```powershell
cloudflared tunnel --url http://127.0.0.1:8765 --no-autoupdate
```

発行された`https://*.trycloudflare.com`をRenderの`PADDLE_OCR_ENDPOINT`へ設定する。
Quick TunnelのURLは再起動ごとに変わるため、常用する場合はその都度Renderを更新する。
固定運用へ移行するときは、次のNamed Tunnelを使用する。
## Cloudflare Tunnel

CloudflareのNamed Tunnelを使用し、固定ホスト名をOCRゲートウェイだけへ割り当てる。
`config.yml`の例:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<USER>\.cloudflared\<TUNNEL_ID>.json
ingress:
  - hostname: ocr.example.com
    service: http://127.0.0.1:8765
  - service: http_status:404
```

起動:

```powershell
cloudflared tunnel run <TUNNEL_NAME>
```

Renderには次を設定する。

```text
OCR_MODE=economy
OCR_PROVIDER=paddle
PADDLE_OCR_ENDPOINT=https://ocr.example.com
PADDLE_OCR_TOKEN=<秘密トークン>
PADDLE_OCR_TIMEOUT_MS=30000
```

## 停止

1. Cloudflare Tunnelを停止する。
2. PaddleOCRゲートウェイを停止する。

停止中、Inputの画像OCRは「現在利用できません」と表示される。文章の貼り付け、解析、
確認、Google Sheetsへの登録は引き続き利用できる。

## データの扱い

- JPEG、PNG、WebPだけを受け付ける。
- デコード後10MBを超える画像は拒否する。
- 画像はOCR処理中の一時ファイルとしてだけ扱い、処理終了時に削除する。
- OCR結果をPC側へ永続保存しない。
- ゲートウェイは`/health`と`/ocr`以外の機能を公開しない。