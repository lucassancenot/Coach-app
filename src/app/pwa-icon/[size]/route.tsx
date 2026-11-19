import { ImageResponse } from "next/og";

// Icônes PNG pour l'installation sur l'écran d'accueil (Android/iOS).
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = [180, 192, 512].includes(Number(size)) ? Number(size) : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e0d" }}>
        <div style={{ width: "62%", height: "62%", borderRadius: "50%", border: `${Math.round(s * 0.07)}px solid #d95926`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "34%", height: "34%", borderRadius: "50%", background: "#3987e5" }} />
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
