export default function HomePage() {
  return (
    <>
<header className="header">
    <a className="logo" href="index.html">Travel App</a>
    <a href="#ideas">旅のアイデア</a>
  </header>
  <main>
    {/* まずはタイトルや説明文を変えてみよう */}
    <section className="hero">
      <p className="eyebrow">みんなでつくる旅行サービス</p>
      <h1>次の旅を、<br />みんなで。</h1>
      <p>行きたい場所を見つけて、旅のアイデアを広げよう。</p>
      <a className="button" href="#ideas">旅のアイデアを見る</a>
    </section>
    {/* カードを増やしたり、写真を付けたりしてみよう */}
    <section id="ideas" className="ideas" aria-labelledby="ideas-title">
      <h2 id="ideas-title">旅のアイデア</h2>
      <p>まずはサンプルから。ここをみんなで育てていこう。</p>
      <div className="cards">
        <article className="card"><span aria-hidden="true">🌊</span><h3>海でのんびり</h3><p>波の音を聞きながら、ゆっくり過ごす旅。</p></article>
        <article className="card"><span aria-hidden="true">🌿</span><h3>自然にふれる</h3><p>緑の中を歩いて、気分をリフレッシュ。</p></article>
        <article className="card"><span aria-hidden="true">🏘️</span><h3>街をめぐる</h3><p>知らない街で、おいしいものや景色を探そう。</p></article>
      </div>
    </section>
  </main>
  <footer>Travel App · <span>{new Date().getFullYear()}</span></footer>
    </>
  );
}
