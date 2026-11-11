import type { MetadataRoute } from "next";

// Lets the app be added to a phone's home screen and open full screen, without the browser's bars.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmartPurchasing",
    short_name: "Purchasing",
    description: "Count stock, order from the cheapest vendor, and check delivery invoices.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
