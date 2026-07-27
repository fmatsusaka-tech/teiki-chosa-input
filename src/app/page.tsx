import { SurveyInputWorkspace } from "./survey-input-workspace";

const phases = ["自由入力", "解析", "確認・修正", "一括登録"];

export default function HomePage() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand-mark" aria-hidden="true">M</div>
          <div>
            <p className="eyebrow">Matsusaka Farm</p>
            <h1>定期調査</h1>
          </div>
          <span className="header-status">入力</span>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero">
          <h2>調査内容を入力</h2>
          <p className="lead">
            メモを貼り付けるか、写真を選んで調査データを読み取ります。
          </p>
        </section>

        <SurveyInputWorkspace />

        <section className="flow" aria-label="登録の流れ">
          {phases.map((phase, index) => (
            <div className="flow-item" key={phase}>
              <span>{index + 1}</span>
              <p>{phase}</p>
            </div>
          ))}
        </section>
      </main>

      <nav className="mobile-nav" aria-label="メインメニュー">
        <a className="is-active" href="#input-title"><span aria-hidden="true">✎</span>入力</a>
        <a href="#results-title"><span aria-hidden="true">☷</span>確認</a>
        <span className="is-disabled" aria-disabled="true"><span aria-hidden="true">◷</span>履歴</span>
      </nav>
    </>
  );
}
