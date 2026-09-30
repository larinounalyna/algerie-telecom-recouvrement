import { useState } from "react";
import type { View } from "./navigation";
export type { View } from "./navigation";
import { AppDataProvider } from "../store/AppData";
import HomePage from "../pages/home/HomePage";
import ClientTypeSelectPage from "../pages/client-type/ClientTypeSelectPage";
import SystemPage from "../pages/system/SystemPage";
import RappelBell from "../features/rappels/RappelBell";
import CorporateArPage from "../features/corporate-ar/CorporateArPage";

export default function App() {
  const [view, setView] = useState<View>("root");

  return (
    <AppDataProvider>
      <div className="h-full flex flex-col bg-bg overflow-hidden">
        <RappelBell />
        {view === "root" && <HomePage onSelect={(s) => setView(s === "entreprises" ? "corporate-ar" : "landing")} />}
        {view === "landing" && <ClientTypeSelectPage onSelect={setView} onBack={() => setView("root")} />}
        {view === "hors-gaia" && (
          <SystemPage system="avant" onBack={() => setView("landing")} onSwitchSystem={(s) => setView(s === "avant" ? "hors-gaia" : "apres-gaia")} />
        )}
        {view === "apres-gaia" && (
          <SystemPage system="apres" onBack={() => setView("landing")} onSwitchSystem={(s) => setView(s === "avant" ? "hors-gaia" : "apres-gaia")} />
        )}
        {view === "corporate-ar" && <CorporateArPage onBack={() => setView("root")} />}
      </div>
    </AppDataProvider>
  );
}
