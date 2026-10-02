export default function PageShell({ title, description, children }) {
  return (
    <section className="page">
      <p className="eyebrow">旅の記録を、みんなで。</p>
      <h1>{title}</h1>
      <p className="description">{description}</p>
      {children}
    </section>
  );
}
