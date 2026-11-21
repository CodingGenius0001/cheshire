// Backbone test page at /dev.html: listener, typed fallback, and /api/speak.
// Styled with the main screen's Wonderland tokens (app.css) so it matches.
import { StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { useListener } from "../hooks/useListener";
import { speak } from "../lib/speak";
import "../styles/app.css";

const card: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "1rem 1.25rem",
  marginTop: "1rem",
};
const row: CSSProperties = { display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" };
const input: CSSProperties = {
  flex: "1 1 16rem",
  font: "inherit",
  color: "var(--text)",
  background: "var(--panel-raised)",
  border: "2px solid var(--border-strong)",
  borderRadius: 12,
  padding: "0.6rem 0.8rem",
};
const button: CSSProperties = {
  font: "inherit",
  fontWeight: 700,
  color: "var(--text)",
  background: "var(--panel-raised)",
  border: "2px solid var(--accent)",
  borderRadius: 999,
  padding: "0.6rem 1.2rem",
  cursor: "pointer",
};
const label: CSSProperties = { color: "var(--accent-text)", fontSize: "1rem", margin: "0 0 0.5rem" };

function DevPanel() {
  const listener = useListener();
  const [partnerText, setPartnerText] = useState("");
  const [sayText, setSayText] = useState("We're all mad here. Lovely to see you!");
  const [status, setStatus] = useState("");

  async function onSpeak() {
    setStatus("Speaking…");
    try {
      await speak(sayText);
      listener.addUserTurn(sayText);
      setStatus("Done");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ color: "var(--grin-text)" }}>Backbone test</h1>
      <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>
        Mic, typed fallback, and voice, without the main screen.
      </p>

      <section style={card}>
        <h2 style={label}>Listen</h2>
        <div style={row}>
          <button
            style={{ ...button, background: listener.listening ? "var(--user)" : button.background }}
            onClick={listener.toggle}
            disabled={!listener.supported}
          >
            {listener.listening ? "Stop listening" : "Start listening"}
          </button>
          {!listener.supported && <span>Speech recognition needs Chrome.</span>}
          {listener.error && <span style={{ color: "var(--grin-text)" }}>Microphone: {listener.error}</span>}
        </div>
        <p style={{ color: "var(--muted)", fontStyle: "italic", minHeight: "1.5em", margin: "0.75rem 0 0" }}>
          {listener.interim}
        </p>
      </section>

      <form
        style={card}
        onSubmit={(e) => {
          e.preventDefault();
          listener.addPartnerTurn(partnerText);
          setPartnerText("");
        }}
      >
        <h2 style={label}>Type what the partner said</h2>
        <div style={row}>
          <input
            style={input}
            value={partnerText}
            onChange={(e) => setPartnerText(e.target.value)}
            placeholder="Would you like some tea?"
            aria-label="Partner's words"
          />
          <button style={button} type="submit">
            Add partner turn
          </button>
        </div>
      </form>

      <section style={card}>
        <h2 style={label}>Speak in the user's voice</h2>
        <div style={row}>
          <input style={input} value={sayText} onChange={(e) => setSayText(e.target.value)} aria-label="Text to speak" />
          <button style={{ ...button, borderColor: "var(--grin)" }} onClick={onSpeak}>
            Speak
          </button>
        </div>
        <p role="status" style={{ color: "var(--muted)", minHeight: "1.5em", margin: "0.75rem 0 0" }}>
          {status}
        </p>
      </section>

      <section style={card}>
        <h2 style={label}>Turns</h2>
        {listener.turns.length === 0 && <p style={{ color: "var(--muted)", margin: 0 }}>Nothing yet.</p>}
        <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {listener.turns.map((t) => (
            <li key={t.id} style={{ marginBottom: "0.4rem" }}>
              <b style={{ color: t.speaker === "partner" ? "var(--accent-text)" : "var(--grin-text)" }}>
                {t.speaker === "partner" ? "Them" : "You"}
              </b>{" "}
              <span style={{ color: "var(--muted)" }}>({t.source})</span> {t.text}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DevPanel />
  </StrictMode>,
);
