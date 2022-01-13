import React, { useEffect, useState, createContext } from "react";
import { auth, onAuthStateChanged, signInWithPopup } from "./firebaseConfig";
import { googleMainProvider } from "./firebaseConfig";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showChild, setShowChild] = useState(false);

  const [googleProvider, setGoogleProvider] = useState(null);

  useEffect(() => {
    let provider = googleMainProvider;
    provider.setCustomParameters({
      prompt: "select_account",
    });
    setGoogleProvider(provider);

    onAuthStateChanged(auth, (user) => {
      setUser(user);
      setShowChild(true);
    });
  }, []);

  const signInWithGoogle = () => {
    signInWithPopup(auth, googleProvider).then((userCredential) =>
      setUser(userCredential.user)
    );
  };

  return (
    <>
      {showChild ? (
        <AuthContext.Provider value={{ user, signInWithGoogle }}>
          {children}
        </AuthContext.Provider>
      ) : (
        <button className="button" onClick={signInWithGoogle}>
          <i className="fab fa-google"></i>Sign in with Google
        </button>
      )}
    </>
  );
};
