# データ形式

## SurveyRecord

```ts
interface SurveyRecord {
  recordId: string;
  measuredDate: string; // YYYY-MM-DD
  orchardId?: string;
  orchardName: string;
  varietyId?: string;
  varietyName: string;
  diameters: number[];
  brix: number | null;
  acidity: number | null;
  remarks: string;
  registeredAt: string; // ISO 8601
  sourceType: "text" | "voice" | "screenshot" | "photo" | "pdf";
  sourceText: string;
  warnings: ParseWarning[];
}
```

## ParseWarning

```ts
interface ParseWarning {
  field?: "measuredDate" | "orchard" | "variety" | "diameters" | "brix" | "acidity" | "remarks";
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}
```

## ParseResult

```ts
interface ParseResult {
  records: SurveyRecordDraft[];
  globalWarnings: ParseWarning[];
  unparsedText: string;
}
```

登録前は `SurveyRecordDraft` として扱い、`recordId` と `registeredAt` は保存時に確定する。
永続化する正本の正式な見出しと欠測値規則は
[Input正本データ辞書](input-data-dictionary.md)を参照する。

保存境界では、ドメインの観測値とは分離して次の管理情報を付与する。

```ts
interface RecordManagementMetadata {
  editKeyHash: string; // Input内部だけで保持し、Outputへ公開しない
  updatedAt: string; // ISO 8601
  revision: number; // 初回1
  dataStatus: "有効" | "要確認" | "取消";
}
```

## 横径

- 内部形式は `number[]`
- 個数は可変
- 空欄を0として保存しない
- 表示平均は、有効な数値のみで算出する
- Google Sheets出力時に `横径1`、`横径2` のように展開する

## 日付と時刻

- `measuredDate` は計測した日
- `registeredAt` はシステムへ登録した日時
- 日付未指定時は登録日の日本時間を仮設定し、警告を付ける

## マスターデータ

園地・品種は、表示名と表記揺れを分離する。

```ts
interface MasterItem {
  id: string;
  canonicalName: string;
  aliases: string[];
  isActive: boolean;
}
```

既存データとの互換性が必要な場合でも、内部IDを持てる設計とする。

## 将来の調査項目

果実数、果実重、LWP、葉色、果皮色等を追加できるよう、将来的には項目定義を設定データとして持つ。

```ts
interface SurveyFieldDefinition {
  key: string;
  label: string;
  type: "number" | "text" | "date" | "select" | "number-array";
  unit?: string;
  required: boolean;
  enabled: boolean;
}
```

初期実装で過度に汎用化しすぎないが、画面・保存・出力を一体化しない。
