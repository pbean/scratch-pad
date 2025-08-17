import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./components/ui/button";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">Scratch Pad</h1>
        <p className="text-muted-foreground text-center">
          A floating notepad for developers
        </p>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
          />
          <Button type="submit" className="w-full">
            Greet
          </Button>
        </form>
        
        {greetMsg && (
          <p className="text-center p-4 bg-muted rounded-md">{greetMsg}</p>
        )}
      </div>
    </div>
  );
}

export default App;
