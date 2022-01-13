import { useContext } from "react";
import { AuthContext } from "../firebase/AuthProvider";

const LoginPage = ({ children }) => {
  const { signInWithGoogle } = useContext(AuthContext);
  return (
    <>
      <button className="button" onClick={signInWithGoogle}>
        <i className="fab fa-google"></i>Sign in with Google
      </button>
    </>
  );
};

export default LoginPage;
