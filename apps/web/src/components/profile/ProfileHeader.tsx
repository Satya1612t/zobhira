export function ProfileHeader({ name, memberSince }: { name: string; memberSince: string }) {
  return (
    <div className="profile-header-band edge-arc-bottom deco-grain" style={{ background: "var(--gradient-accent)" }}>
      <div className="container" style={{ position: "relative", paddingBlock: "28px 52px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div className="profile-avatar-overlap shape-arch">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: "var(--color-accent)" }}>
                {name[0]}
              </span>
            </div>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 4px", color: "#fff" }}>
                {name}
              </h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                Member since {memberSince}
              </p>
            </div>
          </div>
          <button type="button" className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
            Edit profile
          </button>
        </div>
      </div>
    </div>
  );
}
