import React, { useEffect, useState, createContext, useContext } from "react";
import {
  db,
  ref,
  get,
  set,
  onValue,
  push,
  child,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  remove,
} from "./firebaseConfig";
import { AuthContext } from "./AuthProvider";
// import { remove } from "firebase/database";

export const DatabaseContext = createContext();

export const DatabaseProvider = ({ children }) => {
  // STATE VARIABLES
  const [database, setDatabase] = useState();
  const [roomsRef, setRoomsRef] = useState();
  const [usersRef, setUsersRef] = useState();
  const [showChild, setShowChild] = useState(false);
  // const [participantsRef, setParticipantsRef] = useState();
  // const [queueRef, setQueueRef] = useState();

  const [roomsInfo, setRoomsInfo] = useState({});

  const { user } = useContext(AuthContext);

  // REACT HOOKS
  useEffect(() => {
    console.log("Loading Firebase");
    setDatabase(db);
  }, []);

  useEffect(() => {
    if (database) {
      let refForRooms = ref(database, "rooms");
      let refForUsers = ref(database, "users");

      setShowChild(true);
      setRoomsRef(refForRooms);
      setUsersRef(refForUsers);

      onChildAdded(refForRooms, (data) => {
        // addCommentElement(postElement, data.key, data.val().text, data.val().author);
        console.log("CHILD ADDED", data);
        setRoomsInfo({
          ...roomsInfo,
          [data.key]: data.val(),
        });
      });

      onChildChanged(refForRooms, (data) => {
        // setCommentValues(postElement, data.key, data.val().text, data.val().author);
        console.log("CHILD CHANGED", data);
        setRoomsInfo({
          ...roomsInfo,
          [data.key]: data.val(),
        });
      });

      onChildRemoved(refForRooms, (data) => {
        // deleteComment(postElement, data.key);
        console.log("CHILD REMOVED", data);
        setRoomsInfo((prevRoomsInfo) => {
          let newRoomsInfo = prevRoomsInfo;
          console.log("BEFORE DELETING", newRoomsInfo);
          delete newRoomsInfo[data.key];
          console.log("AFTER DELETING", newRoomsInfo);
          return {
            ...newRoomsInfo,
          };
        });
      });

      onChildAdded(refForUsers, (data) => {
        // addCommentElement(postElement, data.key, data.val().text, data.val().author);
      });

      onChildChanged(refForUsers, (data) => {
        // setCommentValues(postElement, data.key, data.val().text, data.val().author);
      });

      onChildRemoved(refForUsers, (data) => {
        // deleteComment(postElement, data.key);
      });
    }
  }, [database]);

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

  const addToQueue = (room) => {
    let databaseRef = ref(database, `rooms/${room}/queue`);
    let databaseListRef = push(databaseRef);
    set(databaseListRef, user.uid);
  };

  const removeFromQueue = (room) => {
    let roomQueue = roomsInfo[room].queue;
    let timestampId = null;
    for (let t in roomQueue) {
      if (roomQueue[t] == user.uid) {
        timestampId = t;
        break;
      }
    }

    if (!timestampId) return;

    let queueRef = ref(database, `rooms/${room}/queue/${timestampId}`);
    remove(queueRef);
  };

  const isOnQueue = (room) => {
    let roomQueue = roomsInfo[room]?.queue;
    if (!roomQueue) return false;
    let usersInQueue = Object.values(roomQueue);
    return usersInQueue.includes(user.uid);
  };

  const isMyTurn = (room) => {
    let roomQueue = roomsInfo[room]?.queue;
    if (!roomQueue) return false;
    let firstKey = Object.keys(roomQueue)[0];
    return roomQueue[firstKey] == user.uid;
  };

  return (
    <>
      {showChild ? (
        <DatabaseContext.Provider
          value={{
            database,
            readData,
            writeData,
            removeFromQueue,
            addToQueue,
            isOnQueue,
            isMyTurn,
            roomsInfo,
          }}
        >
          {children}
        </DatabaseContext.Provider>
      ) : (
        "Connecting to database"
      )}
    </>
  );
};
