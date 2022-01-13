import { useContext } from "react";
import ChatsLayout from "../ChatsMenu/ChatsLayout";
import { AuthContext } from "../firebase/AuthProvider";
import LoginPage from "../Login/LoginPage";

const MainPage = ({ children }) => {
  const { user } = useContext(AuthContext);

  return <>{user ? <ChatsLayout></ChatsLayout> : <LoginPage></LoginPage>}</>;
};
export default MainPage;
