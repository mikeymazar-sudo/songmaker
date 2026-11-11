import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The phone rounds the corners itself, so the icon is a full square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        SP
      </div>
    ),
    { ...size },
  );
}
