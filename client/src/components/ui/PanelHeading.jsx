export function PanelHeading({ title, count, search, setSearch }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{count}</p>
      </div>
      <input
        className="search-input"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search title, author, or student"
      />
    </div>
  );
}
