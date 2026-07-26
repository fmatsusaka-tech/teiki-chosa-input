import { describe, expect, it } from "vitest";
import { parseSurveyMemo } from "./parse-survey-memo";

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
      notes: "無処理区",
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
      variety: "早生",
      diametersMm: [74.2, 72.4, 82.5, 71.5, 76.3, 80],
    });
  });

  it("横径数の不足と不自然な負数を警告する", () => {
    const result = parseSurveyMemo(memo);
    const shimomachi = result.records.find((record) => record.orchard === "下町");
    const tokuda = result.records.find((record) => record.orchard === "徳田");

    expect(shimomachi?.warnings).toContain("横径が4個です");
    expect(tokuda?.diametersMm).toEqual([73.4, 68.1, 64.2, 54.3]);
    expect(tokuda?.warnings.some((warning) => warning.includes("-681"))).toBe(true);
  });

  it("糖度と酸度が無い入力では横径を削らず未入力警告を付ける", () => {
    const result = parseSurveyMemo(incompleteMemo, "2026-07-18T07:00:00.000Z");

    expect(result.records).toHaveLength(9);
    expect(result.records[0]).toMatchObject({
      orchard: "有中",
      notes: "無処理区",
      diametersMm: [50.6, 50.4, 56.1, 57, 51.3, 57.2],
      brix: null,
      acidity: null,
      measuredAt: "2026-11-16T00:00:00.000Z",
    });
    expect(result.records[0].warnings).toContain("糖度が未入力です");
    expect(result.records[0].warnings).toContain("酸度が未入力です");

    expect(result.records[1]).toMatchObject({
      orchard: "有中",
      notes: "スキー",
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
});
