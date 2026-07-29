# OCR Provider設定ガイド

## 目的

画像認識機能を特定のOCR/AIサービスに固定しないため、OCR Providerの共通インターフェース、DTO、Provider Registry / Factory、動作モード設定を用意している。

PaddleOCRはPythonサイドカーとして実行し、TypeScript側のProviderから共通DTOへ変換する。OpenAI Vision、JAスクリーンショット解析、UI連携はこの文書の対象外とする。

## 環境変数

| 変数 | 値 | 既定値 | 説明 |
|---|---|---|---|
| `OCR_MODE` | `economy`, `standard`, `local` | `economy` | OCRの運用モード。 |
| `OCR_PROVIDER` | `paddle`, `openai`, `local` | モードごとの既定値 | 最初に利用するProvider。 |
| `PADDLE_OCR_ENDPOINT` | URL | `http://127.0.0.1:8765` | PaddleOCRサイドカーの接続先。 |
| `PADDLE_OCR_TIMEOUT_MS` | 正の整数 | `30000` | ヘルスチェック・認識要求のタイムアウト（ミリ秒）。 |
| `PADDLE_OCR_LANG` | PaddleOCR言語名 | `japan` | Pythonサイドカーが読み込む言語モデル。 |
| `PADDLE_OCR_TOKEN` | 秘密文字列 | なし | InputからOCRゲートウェイへ送るBearerトークン。 |
| `OCR_GATEWAY_TOKEN` | 秘密文字列 | なし | PC側OCRゲートウェイが照合する同一トークン。 |

## 動作モード

| モード | 既定Provider | フォールバック候補 | 想定用途 |
|---|---|---|---|
| `economy` | `paddle` | なし | PaddleOCRのみで低コストに運用する。 |
| `standard` | `paddle` | `openai` | PaddleOCRを基本とし、将来は低信頼・解析不能時に外部LLMへフォールバックする。 |
| `local` | `local` | なし | ローカルOCRとローカルVLM/LLMで閉じた運用を行う。 |

現時点ではフォールバックの実行処理は実装していない。`createOcrProviderSelection()` は主ProviderとフォールバックProviderの候補を返すだけに留めている。

## 安全な既定値

OCR関連の環境変数が未指定の場合、`economy` モードかつ `paddle` Providerを選択する。Providerの生成時にはサイドカーへ接続しないため、サイドカー停止中でもアプリ自体は起動できる。

PaddleOCRサイドカーが利用不能な場合は次のように扱う。

- `checkAvailability()` は `available: false` と `PROVIDER_UNAVAILABLE` を返す。
- `recognize()` はProvider固有例外を共通の`OcrProviderError`へ変換する。
- Providerの生成だけではアプリ全体を起動不能にしない。
- リモート接続先はHTTPSだけを許可する。
- トークン未設定・不正認証時もOCRだけを利用不能とし、文章入力と登録は継続する。

## 開発者向け利用例

```ts
import { createOcrProviderSelection } from "../services/ocr";

const selection = createOcrProviderSelection();
const availability = await selection.provider.checkAvailability();

if (!availability.available) {
  // UIやAPI routeでは、利用者が次に何をすべきか分かる日本語メッセージへ変換する。
}
```

## Windowsでのサイドカー起動

PowerShellでPython 3.11の仮想環境を作成し、次の順に実行する。初回起動時にはPaddleOCRの日本語モデルがダウンロードされるため、ネットワーク接続が必要になる。

```powershell
py -3.11 -m venv .venv-paddleocr
.\.venv-paddleocr\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r sidecars/paddleocr/requirements.txt
python -m uvicorn app:app --app-dir sidecars/paddleocr --host 127.0.0.1 --port 8765
```

別のPowerShellで疎通を確認する。

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

CPU版を標準とし、GPU版PaddlePaddleへの置換は利用環境に合わせてPaddlePaddle公式手順を確認する。サイドカーは画像から文字・信頼度・座標を返すだけで、JA固有解析や調査データ保存は行わない。

リモート接続のTunnel設定、起動・停止、トークン更新は [自宅PC OCRゲートウェイ運用手順](remote-ocr-gateway.md) を参照する。

## 後続PRで実装すること

- OpenAI Vision Provider
- ローカルVLM/LLM Provider
- OCR結果からJAスクリーンショット用の構造化データへ変換するParser
- 画像アップロードAPIと確認UI
- `SurveyRecord` への保存や画像ファイル永続化
