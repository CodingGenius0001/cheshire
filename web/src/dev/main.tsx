// Backbone test page at /dev.html: listener, typed fallback, and /api/speak.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useListener } from "../hooks/useListener";
import { speak } from "../lib/speak";

function DevPanel() {
  const listener = useListener();
  const [partnerText, setPartnerText] = useState("");
  const [sayText, setSayText] = useState("Hi! It's really good to see you.");
  const [status, setStatus] = useState("");

  async function onSpeak() {
    setStatus("speaking…");
    try {
      await speak(sayText);
      listener.addUserTurn(sayText);
      setStatus("done");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>Backbone test</h1>

      <section>
        <button onClick={listener.toggle} disabled={!listener.supported}>
          {listener.listening ? "Stop listening" : "Start listening"}
        </button>
        {!listener.supported && <span> Speech recognition needs Chrome.</span>}
        {listener.error && <span style={{ color: "crimson" }}> {listener.error}</span>}
        <p style={{ color: "gray", minHeight: "1.5em" }}>{listener.interim}</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          listener.addPartnerTurn(partnerText);
          setPartnerText("");
        }}
      >
        <input
          value={partnerText}
          onChange={(e) => setPartnerText(e.target.value)}
          placeholder="Type the partner's question"
          style={{ width: "70%" }}
        />
        <button type="submit">Add partner turn</button>
      </form>

      <section style={{ marginTop: 16 }}>
        <input value={sayText} onChange={(e) => setSayText(e.target.value)} style={{ width: "70%" }} />
        <button onClick={onSpeak}>Speak</button>
        <span> {status}</span>
      </section>

      <ol>
        {listener.turns.map((t) => (
          <li key={t.id}>
            <b>{t.speaker}</b> ({t.source}): {t.text}
          </li>
        ))}
      </ol>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DevPanel />
  </StrictMode>,
);
