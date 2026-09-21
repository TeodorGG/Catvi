import shapes from "@/lib/map-shapes.json";
export default function MoldovaMap({
  regions = [],
  decorative = false,
  onSelect,
}) {
  const byName = Object.fromEntries(regions.map((r) => [r.region, r]));
  return (
    <svg
      className="moldova-map"
      viewBox="-5 -5 290 330"
      role="img"
      aria-label="Harta regiunilor Republicii Moldova"
    >
      <title>Republica Moldova — măsurători pe regiuni</title>
      {shapes.map((shape) => {
        const data = byName[shape.name];
        const fill = data
          ? Number(data.avg_down) >= 100
            ? "#2156df"
            : Number(data.avg_down) >= 30
              ? "#85a8ef"
              : "#c9d8f6"
          : undefined;
        return (
          <path
            key={shape.name}
            d={shape.path}
            style={fill ? { fill } : undefined}
            className={data ? "has-data" : ""}
            onClick={onSelect ? () => onSelect(shape.name) : undefined}
            tabIndex={onSelect ? 0 : undefined}
            role={onSelect ? "button" : undefined}
            aria-label={onSelect ? shape.name : undefined}
            onKeyDown={
              onSelect
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(shape.name);
                    }
                  }
                : undefined
            }
          >
            <title>{`${shape.name}: ${data ? `${Number(data.avg_down).toFixed(1)} Mbps · ${data.sample_count} teste` : "date insuficiente"}`}</title>
          </path>
        );
      })}
      {decorative && (
        <g className="map-city">
          <circle cx="166" cy="162" r="4" />
          <text x="177" y="166">
            Chișinău
          </text>
        </g>
      )}
    </svg>
  );
}
