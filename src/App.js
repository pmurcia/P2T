// Main library
import React from "react";

// Style
import "./App.css";

// Components
import ChatsLayout from "./ChatsMenu/ChatsLayout";
import MainPage from "./MainPage/MainPage";

// Providers
import { JanusProvider } from "./janus/JanusProvider";
import { DatabaseProvider } from "./firebase/DatabaseProvider";
import { AuthProvider } from "./firebase/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <JanusProvider>
          <div className="App">
            <MainPage></MainPage>
          </div>
        </JanusProvider>
      </DatabaseProvider>
    </AuthProvider>
  );
}

export default App;
