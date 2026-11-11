import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: -0.5,
        }}
      >
        SP
      </div>
    ),
    { ...size },
  );
}
