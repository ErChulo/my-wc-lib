export type HelloCardProps = {
  name?: string;
};

export function HelloCard({ name = "World" }: HelloCardProps) {
  return (
    <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>Hello, {name}!</h3>
      <p style={{ margin: "8px 0 0" }}>
        This is a React component shipped as a Web Component.
      </p>
    </div>
  );
}
