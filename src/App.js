// Main library
import React from "react";

// Style
import "./App.css";

// Components
import ChatsLayout from "./ChatsMenu/ChatsLayout";

// Providers
import { JanusProvider } from "./janus/JanusProvider";
import { DatabaseProvider } from "./firebase/DatabaseProvider";

function App() {
  return (
    <DatabaseProvider>
      <JanusProvider>
        <div className="App">
          <ChatsLayout></ChatsLayout>
        </div>
      </JanusProvider>
    </DatabaseProvider>
  );
}

export default App;
