/**
 * The social share image (Milestone 23) — generated, not a static file.
 *
 * This is what appears when someone pastes the link into WhatsApp, LinkedIn, Slack
 * or iMessage — which is exactly how one restaurant owner tells another about a
 * tool. Without it, the link renders as a bare grey rectangle, and for a product
 * whose entire pitch is "premium and trustworthy", that IS the first impression.
 *
 * Next renders this at build time with the same design language as the site: the
 * wordmark as the logo, near-black on white, one amber accent, no icons.
 */

import { ImageResponse } from "next/og";

export const alt = "ScoreFlow — hear it at the table, not on Google";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#1D1D1F",
            }}
          >
            ScoreFlow
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#F59E0B",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 82,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              color: "#1D1D1F",
            }}
          >
            Hear it at the table.
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
              color: "#AEAEB2",
            }}
          >
            Not on Google.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 26,
            color: "#6E6E73",
          }}
        >
          <span>Guest feedback for restaurants</span>
          <span style={{ color: "#D2D2D7" }}>·</span>
          <span>14 days free</span>
        </div>
      </div>
    ),
    size
  );
}
