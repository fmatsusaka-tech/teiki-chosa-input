import { describe, expect, it } from "vitest";
import { parseSurveyMemo } from "./parse-survey-memo";
import { WASE_VARIETY_NAME } from "./survey-masters";

const memo = `2025/11/16

有中
無処理区
506
504
561
570
513
572
16.1
1.0

有中
スキー
602
580
607
541
562
535
14.4
1.1

有中
ミヨビ
501
611
473
574
596
624
13.5
0.7

吉川
461
570
561
571
523
573
14.5
0.7

なる1
546
476
601
597
622
632
14.0
0.8

なる2
742
724
825
715
763
800
10.4
0.7

上中島
720
617
643
683
687
622
10.9
0.7

下町
717
614
754
730
10.0
0.8

徳田
734
-681
642
543
11.2
0.9`;

const incompleteMemo = `11/16

有中
無処理区
506
504
561
570
513
572

スキー
602
580
607
541
562
535

ミヨビ
501
611
473
574
596
624

吉川
461
570
561
571
523
573

なる1
546
476
601
597
622
632

なる2
742
724
825
715
763
800
売り物サイズを検査

上中島
720
617
643
683
687
622

下町
717
614
754
730

徳田
734
-681
642
543`;

describe("parseSurveyMemo", () => {
  it("複数園地と処理区を9レコードに分割する", () => {
    const result = parseSurveyMemo(memo, "2026-07-18T07:00:00.000Z");

    expect(result.records).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      orchard: "有中",
      variety: "ゆら早生",
      treatment: "無処理区",
      notes: "",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: 16.1,
      acidity: 1,
      measuredAt: "2025-11-16T00:00:00.000Z",
    });

    expect(result.records[4]).toMatchObject({
      orchard: "なる1",
      variety: "ゆら早生",
    });

    expect(result.records[5]).toMatchObject({
      orchard: "なる2",
      variety: WASE_VARIETY_NAME,
      diametersMm: [74.2, 72.4, 82.5, 71.5, 76.3, 80],
    });
  });

  it("横径が1個以上あれば個数を警告せず、不自然な負数だけ警告する", () => {
    const result = parseSurveyMemo(memo);
    const shimomachi = result.records.find((record) => record.orchard === "下町");
    const tokuda = result.records.find((record) => record.orchard === "徳田");

    expect(shimomachi?.warnings).not.toContain("横径が4個です");
    expect(tokuda?.diametersMm).toEqual([73.4, 68.1, 64.2, 54.3]);
    expect(tokuda?.warnings.some((warning) => warning.includes("-681"))).toBe(true);
  });

  it("糖度と酸度が無い入力では横径を削らず糖度だけ未入力警告を付ける", () => {
    const result = parseSurveyMemo(incompleteMemo, "2026-07-18T07:00:00.000Z");

    expect(result.records).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      orchard: "有中",
      treatment: "無処理区",
      notes: "",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: null,
      acidity: null,
      measuredAt: "2026-11-16T00:00:00.000Z",
    });
    expect(result.records[0].warnings).toContain("糖度が未入力です");
    expect(result.records[0].warnings).not.toContain("酸度が未入力です");

    expect(result.records[1]).toMatchObject({
      orchard: "有中",
      treatment: "スキー",
      notes: "",
      diametersMm: [60.2, 58, 60.7, 54.1, 56.2, 53.5],
    });

    expect(result.records[5]).toMatchObject({
      orchard: "なる2",
      notes: "売り物サイズを検査",
      diametersMm: [74.2, 72.4, 82.5, 71.5, 76.3, 80],
    });
  });

  it("園地名と品種名を含む見出しを合意済みの組み合わせへ分ける", () => {
    const result = parseSurveyMemo(`出雲田口
35
40
39
37
38

越間ゆら
39
35
34
33
36`);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      orchard: "出雲田口",
      variety: "田口",
      diametersMm: [35, 40, 39, 37, 38],
    });
    expect(result.records[1]).toMatchObject({
      orchard: "越間",
      variety: "ゆら早生",
      diametersMm: [39, 35, 34, 33, 36],
    });
  });

  it("新しい園地名だけの見出しは品種未設定として解析する", () => {
    const result = parseSurveyMemo(`紅下
38
40
36
34
41

紅東
40
40
35
36
36
35

紅出雲
40
33
38
42
36.5`);

    expect(result.records.map((record) => record.orchard)).toEqual([
      "紅下",
      "紅東",
      "紅出雲",
    ]);
    expect(result.records.every((record) => record.variety === "未設定")).toBe(true);
    expect(
      result.records.every((record) =>
        record.warnings.includes("品種を特定できませんでした"),
      ),
    ).toBe(true);
  });

  it("マスタ未登録の園地でも数値のまとまりを候補として解析する", () => {
    const result = parseSurveyMemo(`できたて新園地
41
42
43
44`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "できたて新園地",
      variety: "未設定",
      diametersMm: [41, 42, 43, 44],
    });
    expect(
      result.records[0].warnings.some((warning) => warning.includes("マスタにない園地ですね")),
    ).toBe(true);
  });

  it("外部マスタの別名と既定品種を解析に使用する", () => {
    const result = parseSurveyMemo(
      `新園地ゆら
41
42
43`,
      "2026-07-26T00:00:00.000Z",
      {
        orchards: [
          {
            id: "new",
            canonicalName: "新園地",
            aliases: ["新園地ゆら"],
            isActive: true,
          },
        ],
        varieties: [],
        treatments: [],
        orchardVarietyDefaults: { 新園地: "ゆら早生" },
      },
    );

    expect(result.records[0]).toMatchObject({
      orchard: "新園地",
      variety: "ゆら早生",
      diametersMm: [41, 42, 43],
    });
  });

  it("外部マスタの園地別名に続く品種を園地として上書きしない", () => {
    const result = parseSurveyMemo(
      `トクダ
早生
41
42
10.5`,
      "2026-07-26T00:00:00.000Z",
      {
        orchards: [
          {
            id: "tokuda",
            canonicalName: "徳田",
            aliases: ["トクダ"],
            isActive: true,
          },
        ],
        varieties: [
          {
            id: "wase",
            canonicalName: "早生",
            aliases: [],
            isActive: true,
          },
        ],
        treatments: [],
        orchardVarietyDefaults: {},
      },
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "徳田",
      variety: "早生",
      diametersMm: [41, 42, 10.5],
    });
  });

  it.each(["宮川", "興津", "興津早生", "山下紅", "早生"])(
    "品種名%sを早生の正式品種名へ正規化する",
    (varietyAlias) => {
      const result = parseSurveyMemo(`徳田
${varietyAlias}
40
41
42
43
44
10.5
1.0`);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].variety).toBe(WASE_VARIETY_NAME);
    },
  );

  it("横径がミリ単位の見出し付きでも解析できる", () => {
    const result = parseSurveyMemo(`徳田
ゆら
49.8ミリ
46.4ミリ
46.6ミリ
8.6
3.54`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "徳田",
      variety: "ゆら早生",
      diametersMm: [49.8, 46.4, 46.6],
      brix: 8.6,
      acidity: 3.54,
    });
  });

  it.each(["mm", "MM", "㎜"])("横径の単位%sも解析できる", (unit) => {
    const result = parseSurveyMemo(`徳田
41${unit}
42${unit}
43${unit}
10.5
1.0`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].diametersMm).toEqual([41, 42, 43]);
  });

  it("「1番 49.8、2番 45.6」のような番号付き一行横径を解析できる", () => {
    const result = parseSurveyMemo(
      `向山畑
向山
1番 49.8、2番 45.6、3番 45.4。
8.2
3.7`,
      undefined,
      {
        orchards: [
          { id: "mukoyama-hatake", canonicalName: "向山畑", aliases: [], isActive: true },
        ],
        varieties: [
          { id: "mukoyama", canonicalName: "向山", aliases: [], isActive: true },
        ],
        treatments: [],
        orchardVarietyDefaults: {},
      },
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "向山畑",
      variety: "向山",
      diametersMm: [49.8, 45.6, 45.4],
      brix: 8.2,
      acidity: 3.7,
    });
  });

  it("「1. 46.1」のような番号付き複数行横径を解析できる", () => {
    const result = parseSurveyMemo(`徳田
ゆら
1. 46.1
2. 46.3
3. 44.5
8.6
2.87`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "徳田",
      variety: "ゆら早生",
      diametersMm: [46.1, 46.3, 44.5],
      brix: 8.6,
      acidity: 2.87,
    });
  });

  it("品種マスタにない見出しは処理区として扱う", () => {
    const result = parseSurveyMemo(
      `寅畑
スキーポン
1. 46.1
2. 46.3
3. 44.5
8.6
2.87`,
      undefined,
      {
        orchards: [{ id: "torahata", canonicalName: "寅畑", aliases: [], isActive: true }],
        varieties: [],
        treatments: [],
        orchardVarietyDefaults: {},
      },
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "寅畑",
      variety: "未設定",
      treatment: "スキーポン",
      notes: "",
      diametersMm: [46.1, 46.3, 44.5],
      brix: 8.6,
      acidity: 2.87,
    });
    expect(result.records[0].warnings).toContain(
      "処理区マスタ未登録です。処理区名を確認してください",
    );
  });

  it("園地（品種：X）と箇条書きの横径・糖度・酸度、変換ミスした園地名の候補提案に対応する", () => {
    const result = parseSurveyMemo(`鳴る1（品種：ゆらわせ）

* 横径：40.1、39.4、37.9、40.5、43.9、44.1
* 糖度：8.2
* 酸度：3.17

鳴る2（品種：わせ）
フィガロン区

* 横径：43.6、45.9、41.6、50.3、48.2、49.5、45.5、41.3、42.6
* 糖度：8.9
* 酸度：3.08


徳打

* 糖度：8.7
* 酸度：3.10`);

    expect(result.records).toHaveLength(3);

    expect(result.records[0]).toMatchObject({
      orchard: "なる1",
      variety: "ゆら早生",
      diametersMm: [40.1, 39.4, 37.9, 40.5, 43.9, 44.1],
      brix: 8.2,
      acidity: 3.17,
    });
    expect(
      result.records[0].warnings.some((warning) => warning.includes("なる1")),
    ).toBe(true);

    expect(result.records[1]).toMatchObject({
      orchard: "なる2",
      treatment: "フィガロン区",
      notes: "",
      diametersMm: [43.6, 45.9, 41.6, 50.3, 48.2, 49.5, 45.5, 41.3, 42.6],
      brix: 8.9,
      acidity: 3.08,
    });
    expect(result.records[1].warnings).toContain(
      "処理区マスタ未登録です。処理区名を確認してください",
    );

    expect(result.records[2]).toMatchObject({
      orchard: "徳田",
      diametersMm: [],
      brix: 8.7,
      acidity: 3.1,
    });
    expect(
      result.records[2].warnings.some((warning) => warning.includes("徳田")),
    ).toBe(true);
    expect(result.records[2].warnings).toContain("横径が未入力です");
  });

  it("「* 玉1：41.3」のような玉番号付き箇条書き横径を解析できる", () => {
    const result = parseSurveyMemo(`徳田

* 玉1：41.3
* 玉2：42.2
* 玉3：43.2
* 糖度：8.7
* 酸度：3.10`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      orchard: "徳田",
      diametersMm: [41.3, 42.2, 43.2],
      brix: 8.7,
      acidity: 3.1,
    });
  });

  it("園地見出しの「品種：X・Y」を品種と処理区に分割する", () => {
    const result = parseSurveyMemo(`なる2（品種：わせ・フィガロン区）

* 玉1：43.6
* 玉2：45.9
* 糖度：8.9
* 酸度：3.08

12号（品種：YN26・処理区設定なし）

* 玉1：42.5
* 玉2：48.2
* 糖度：8.3
* 酸度：2.04`);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      orchard: "なる2",
      variety: WASE_VARIETY_NAME,
      treatment: "フィガロン区",
    });
    expect(result.records[0].warnings).toContain(
      "処理区マスタ未登録です。処理区名を確認してください",
    );

    expect(result.records[1]).toMatchObject({
      orchard: "12号",
      variety: "YN26",
      treatment: null,
    });
    expect(result.records[1].warnings).not.toContain(
      "処理区マスタ未登録です。処理区名を確認してください",
    );
  });

  it("箇条書きの「備考：」ラベルを備考へそのまま入れる", () => {
    const result = parseSurveyMemo(`吉川

* 玉1：38.2
* 玉2：39.0
* 糖度：10.4
* 酸度：3.05
* 備考：かなり弱ってる`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].notes).toBe("かなり弱ってる");
  });

  it("同じ園地内で処理区ごとの見出しが続く場合、処理区ごとに別レコードへ分ける", () => {
    const result = parseSurveyMemo(`有中（品種：ゆらわせ）
無処理区

* 玉1：38.3
* 玉2：40.8
* 糖度：9.2
* 酸度：2.44

スキーポン区

* 玉1：37.6
* 玉2：43.7
* 糖度：9.1
* 酸度：2.74

フィガロン区

* 玉1：43.9
* 玉2：46.6
* 糖度：8.6
* 酸度：2.76`);

    expect(result.records).toHaveLength(3);
    expect(result.records.map((r) => r.orchard)).toEqual(["有中", "有中", "有中"]);
    expect(result.records.map((r) => r.treatment)).toEqual([
      "無処理区",
      "スキーポン区",
      "フィガロン区",
    ]);
    expect(result.records.map((r) => r.diametersMm)).toEqual([
      [38.3, 40.8],
      [37.6, 43.7],
      [43.9, 46.6],
    ]);
    expect(result.records.every((r) => r.variety === "ゆら早生")).toBe(true);
  });

  it.each([
    ["田口早生", "田口"],
    ["林", "晩生（林など）"],
  ])("品種名%sを正式品種名%sへ正規化する", (varietyAlias, expected) => {
    const result = parseSurveyMemo(`徳田
${varietyAlias}
40
41
42
43
44
10.5
1.0`);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].variety).toBe(expected);
  });
});
