import React from "react";

export type CounterProps = {
  start?: number;
  step?: number;
  onChange?: (value: number) => void; // we’ll wire this to a DOM CustomEvent
};

export function Counter({ start = 0, step = 1, onChange }: CounterProps) {
  const [value, setValue] = React.useState(start);

  React.useEffect(() => {
    setValue(start);
  }, [start]);

  function inc() {
    const next = value + step;
    setValue(next);
    onChange?.(next);
  }

  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>Value: {value}</div>
      <button onClick={inc}>+{step}</button>
    </div>
  );
}
