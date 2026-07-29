import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The console layout: fixed sidebar + a scrolling main column under the slim
 * app bar. Used as the layout route element so every page renders inside it.
 */
export function AppShell() {
  return (
    <div className="flex h-full min-h-screen w-full bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="fleet-scroll flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
