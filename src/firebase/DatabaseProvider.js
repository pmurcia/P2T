import React, { useEffect, useState, createContext } from "react";
import app from "./firebaseConfig";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  push,
  child,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
} from "firebase/database";

export const DatabaseContext = createContext();

export const DatabaseProvider = ({ children }) => {
  // STATE VARIABLES
  const [database, setDatabase] = useState();

  // REACT HOOKS
  useEffect(() => {
    let databaseFirebase = getDatabase(app);
    setDatabase(databaseFirebase);
  }, []);

  // METHODS
  const writeData = (params, data) => {
    let databaseRef = ref(
      database,
      `rooms/${params["room"]}/${params["target"]}`
    );
    set(databaseRef, data);
  };

  const readData = (params) => {
    let databaseRef = ref(
      database,
      `rooms/${params["room"]}/${params["target"]}`
    );
    get(child(databaseRef, `rooms/${params["room"]}`))
      .then((snapshot) => {
        if (snapshot.exists()) {
          console.log(snapshot.val());
          return snapshot.val();
        } else {
          console.log("No data available");
        }
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const readDataListener = (params) => {
    let databaseRef = ref(database, `rooms/${params["room"]}`);
    onValue(databaseRef, (snapshot) => {
      const data = snapshot.val();
      return data;
    });
  };

  const appendData = (params, data) => {
    let databaseRef = ref(
      database,
      `rooms/${params["room"]}/${params["target"]}`
    );
    let databaseListRef = push(databaseRef);
    set(databaseListRef, data);
  };

  const prepareEventListeners = (params) => {
    let databaseRef = ref(database, `rooms/${params["room"]}`);
    onChildAdded(databaseRef, (data) => {
      // addCommentElement(postElement, data.key, data.val().text, data.val().author);
    });

    onChildChanged(databaseRef, (data) => {
      // setCommentValues(postElement, data.key, data.val().text, data.val().author);
    });

    onChildRemoved(databaseRef, (data) => {
      // deleteComment(postElement, data.key);
    });
  };

  return (
    <DatabaseContext.Provider
      value={{ database, readData, writeData, appendData }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
