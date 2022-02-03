import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "../firebase/AuthProvider";
import { DatabaseContext } from "../firebase/DatabaseProvider";
import Janus from "./janus.es";

export const JanusContext = createContext();
let transactionsTemp = {};
let descriptionTemp = "";

export const JanusProvider = ({ children }) => {
  // STATE MANAGEMENT
  // GLOBAL
  const [sessions, setSessions] = useState([]);
  const [pluginHandles, setPluginHandles] = useState([]);
  const [pluginParticipants, setPluginParticipants] = useState({});
  const [pluginMessages, setPluginMessages] = useState({});

  // CURRENT
  const [currentSession, setCurrentSession] = useState();
  const [currentPluginHandle, setCurrentPluginHandle] = useState();
  const [currentRoom, setCurrentRoom] = useState(null);
  const [transactions, setTransactions] = useState({});
  const [participants, setParticipants] = useState({});
  const [messages, setMessages] = useState([]);

  // USER INFORMATION
  const { user } = useContext(AuthContext);
  const {
    database,
    readData,
    writeData,
    removeFromQueue,
    addToQueue,
    isOnQueue,
    isMyTurn,
    roomsInfo,
    appendMessage,
    addUserRoom,
    addToRoomParticipants,
    usersInfo,
    addRoomToList,
  } = useContext(DatabaseContext);
  const [myusername, setMyUsername] = useState("");
  const [myid, setMyId] = useState("");
  const [sessionOk, setSessionOk] = useState(false);

  // REACT HOOKS
  const defaultDependencies = Janus.useDefaultDependencies();

  useEffect(() => {
    console.log("Connecting to room", currentRoom);
    let messagesRaw = roomsInfo[currentRoom]?.messages;
    let messagesTemp = messagesRaw ? Object.values(messagesRaw) : [];
    console.log({ roomsInfo, messagesTemp });
    messagesTemp = messagesTemp.map((message) => parseMessage(message));
    console.log({ roomsInfo, messagesTemp });
    setMessages(messagesTemp);
  }, [currentRoom]);

  const parseMessage = ({ text, from, date }) => {
    let msg = escapeXmlTags(text);
    let dateString = date;
    return {
      text: msg,
      author: from,
      timestamp: dateString,
    };
  };

  useEffect(() => {
    if (user) {
      // User logged in
      setMyId(user.uid);
      setMyUsername(escapeXmlTags(user.displayName));

      transactionsTemp = transactions;

      // We start Janus service
      init()
        .then(() => createSession())
        .then((session) => attachTextRoomPlugin(session))
        .then((pluginHandle) => {
          console.log("INITIALIZATION PLUGIN HANDLE", pluginHandle);
          addNewPluginHandle(pluginHandle);
          // registerUsername(myusername);
        });
    }
  }, [user]);

  useEffect(() => {
    console.log("Current Session State Changed", { currentSession });
    if (currentSession)
      console.log("Current Session ID", currentSession.getSessionId());
  }, [currentSession]);

  useEffect(() => {
    console.log("Current Plugin Handle State Changed", { currentPluginHandle });
    if (currentPluginHandle && currentPluginHandle?.webrtcStuff?.pc) {
      setSessionOk(true);
    }
  }, [currentPluginHandle]);

  // useEffect(() => {
  //   if (currentRoom) joinRoom(currentRoom);
  // }, [currentRoom]);

  useEffect(() => {
    console.log("New Messages updated", messages);
  }, [messages]);

  useEffect(() => {
    console.log("Participants updated", participants);
  }, [participants]);

  useEffect(() => {
    console.log("Transactions updated", transactions);
  }, [transactions]);

  const init = () => {
    return new Promise((resolve, _) => {
      let initParams = {
        debug: true,
        dependencies: defaultDependencies,
        callback: () => {
          resolve();
        },
      };

      Janus.init(initParams);
    });
  };

  const addNewSession = (session) => {
    setCurrentSession(session);
    setSessions([...sessions, session]);
  };

  const createSession = () => {
    return new Promise((resolve, reject) => {
      let session;
      let params = {
        server: ["ws://localhost:8188/", "http://localhost:8088/janus"],
        success: () => {
          console.log("Success!", session.getSessionId());
          addNewSession(session);
          resolve(session);
        }, // Connected correctly
        error: (error) => {
          console.error("Error creating session", error);
          reject(error);
        },
        destroyed: () => console.log("Destroyed session!"),
      };

      session = new Janus(params);
    });
  };

  const addNewPluginHandle = (pluginHandle) => {
    setPluginHandles([...pluginHandles, pluginHandle]);
    setCurrentPluginHandle(pluginHandle);
  };

  const handleIncomingTransaction = (transaction, json) => {
    console.log({ transactions, transaction });
    if (transaction && transactions[transaction]) {
      // Someone was waiting for this
      // let transactionsNew = transactions;
      console.log("Execute transaction");
      transactions[transaction](json);
      // delete transactionsNew[transaction];
      setTransactions((prevTransactions) => {
        delete prevTransactions[transaction];
        return {
          ...prevTransactions,
        };
      });
    }

    return transaction && transactions[transaction];
  };

  const attachTextRoomPlugin = (session) => {
    // let transactionsNow = transactions;
    return new Promise((resolve, reject) => {
      let textRoom;
      // let transactionsNow;

      let params = {
        plugin: "janus.plugin.textroom",
        success: function (pluginHandle) {
          // Plugin attached! 'pluginHandle' is our handle
          console.log("pluginHandle", pluginHandle);

          textRoom = pluginHandle;
          let body = { request: "setup" };
          textRoom.send({ message: body });

          console.log("SETUP", { pluginHandle, currentPluginHandle });
        },
        error: (cause) => {
          // Couldn't attach to the plugin
          console.error(cause);
        },
        iceState: function (state) {
          Janus.log("ICE state changed to " + state);
        },
        mediaState: function (medium, on) {
          Janus.log(
            "Janus " + (on ? "started" : "stopped") + " receiving our " + medium
          );
        },
        webrtcState: function (on) {
          Janus.log(
            "Janus says our WebRTC PeerConnection is " +
              (on ? "up" : "down") +
              " now"
          );

          on ? resolve(textRoom) : reject(textRoom);
        },
        consentDialog: function (on) {
          // e.g., Darken the screen if on=true (getUserMedia incoming), restore it otherwise
        },
        onmessage: function (msg, jsep) {
          // We got a message/event (msg) from the plugin
          // If jsep is not null, this involves a WebRTC negotiation
          if (msg["error"]) {
            console.error("Onmessage", msg["error"]);
          }
          if (jsep) {
            // Answer
            textRoom.createAnswer({
              jsep: jsep,
              media: { audio: false, video: false, data: true }, // We only use datachannels
              success: function (jsep) {
                Janus.debug("Got SDP!", jsep);
                let body = { request: "ack" };
                textRoom.send({ message: body, jsep: jsep });
              },
              error: function (error) {
                Janus.error("WebRTC error:", error);
              },
            });
          }
        },
        ondataopen: function (data) {
          Janus.log("The DataChannel is available!");
          // Prompt for a display name to join the default room
        },
        ondata: function (data) {
          Janus.debug("We got data from the DataChannel!", data);

          let json = JSON.parse(data);
          let transaction = json["transaction"];
          // transactionsNow = transactions;
          // console.log({ transactionsNow, transaction });
          // if (handleIncomingTransaction(transaction, json)) 7;
          console.log("Execute transaction", { transactionsTemp });
          if (transaction && transactionsTemp[transaction]) {
            // Someone was waiting for this
            // let transactionsNew = transactions;
            transactionsTemp[transaction](json);
            delete transactionsTemp[transaction];
            // delete transactionsNew[transaction];
            setTransactions(transactionsTemp);

            return;
          }
          let what = json["textroom"];
          if (what === "message") {
            // Incoming message: public or private?
            let msg = escapeXmlTags(json["text"]);
            let from = json["from"];
            let dateString = json["date"];
            let whisper = json["whisper"];
            if (whisper) {
              // Private message
              console.log("Private message", msg);
            } else {
              // Public message
              console.log("Public message", msg);
            }

            // Save the message to a database
            // let messagesUpdated = messages;
            let newMessage = {
              text: msg,
              author: from,
              timestamp: dateString,
            };
            setMessages((prevMessages) => {
              return [...prevMessages, newMessage];
            });
          } else if (what === "announcement") {
            // Room announcement
            let msg = escapeXmlTags(json["text"]);
            let dateString = getDateString(json["date"]);
          } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            // let participantsNew = participants ? participants : {};
            // participantsNew[username] = escapeXmlTags(
            //   display ? display : username
            // );
            let newParticipantObject = {};
            let newParticipantValue = escapeXmlTags(
              display ? display : username
            );
            // newParticipantObject[username] = escapeXmlTags(
            //   display ? display : username
            // );
            console.log({ newParticipantObject });
            setParticipants((prevParticipants) => {
              return {
                ...prevParticipants,
                [username]: newParticipantValue,
              };
            });

            // if (username !== myid && !(username in participants)) {
            //   // Add to the participants list
            // }
          } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            let when = new Date();
            // let participantsNew = participants;
            // delete participantsNew[username];
            setParticipants((prevParticipants) => {
              delete prevParticipants[username];
              return {
                ...prevParticipants,
              };
            });
          } else if (what === "kicked") {
            // Somebody was kicked
            let username = json["username"];
            let when = new Date();
            // let participantsNew = participants;
            // delete participantsNew[username];
            // setParticipants(participantsNew);
            setParticipants((prevParticipants) => {
              delete prevParticipants[username];
              return {
                ...prevParticipants,
              };
            });
            if (username === myid) {
              console.log("You have been kicked from the room");
            }
          } else if (what === "destroyed") {
            if (json["room"] !== currentRoom) return;
            // Room was destroyed, goodbye!
            Janus.warn("The room has been destroyed!");
          }
        },
        oncleanup: function () {
          // PeerConnection with the plugin closed, clean the UI
          // The plugin handle is still valid so we can create a new one
        },
        detached: function () {
          // Connection with the plugin closed, get rid of its features
          // The plugin handle is not valid anymore
        },
      };

      console.log("Attached to current session", session);
      session.attach(params);
    });
  };

  const attachVideoRoomPlugin = (session) => {
    let textRoom;
    let params = {
      plugin: "janus.plugin.videoroom",
      success: function (pluginHandle) {
        // Plugin attached! 'pluginHandle' is our handle
        console.log("pluginHandle", pluginHandle);
        addNewPluginHandle(pluginHandle);

        textRoom = pluginHandle;
        let body = { request: "setup" };
        textRoom.send({ message: body });
      },
      error: (cause) => {
        // Couldn't attach to the plugin
        console.error(cause);
      },
      iceState: function (state) {
        Janus.log("ICE state changed to " + state);
      },
      mediaState: function (medium, on) {
        Janus.log(
          "Janus " + (on ? "started" : "stopped") + " receiving our " + medium
        );
      },
      webrtcState: function (on) {
        Janus.log(
          "Janus says our WebRTC PeerConnection is " +
            (on ? "up" : "down") +
            " now"
        );
      },
      consentDialog: function (on) {
        // e.g., Darken the screen if on=true (getUserMedia incoming), restore it otherwise
      },
      onmessage: function (msg, jsep) {
        // We got a message/event (msg) from the plugin
        // If jsep is not null, this involves a WebRTC negotiation
        if (msg["error"]) {
          console.error(msg["error"]);
        }
        if (jsep) {
          // Answer
          textRoom.createAnswer({
            jsep: jsep,
            media: { audio: false, video: false, data: true }, // We only use datachannels
            success: function (jsep) {
              Janus.debug("Got SDP!", jsep);
              let body = { request: "ack" };
              textRoom.send({ message: body, jsep: jsep });
            },
            error: function (error) {
              Janus.error("WebRTC error:", error);
            },
          });
        }
      },
      ondataopen: function (data) {
        Janus.log("The DataChannel is available!");
        // Prompt for a display name to join the default room
      },
      ondata: function (data) {
        Janus.debug("We got data from the DataChannel!", data);

        let json = JSON.parse(data);
        let transaction = json["transaction"];
        if (transactions[transaction]) {
          // Someone was waiting for this
          transactions[transaction](json);
          let transactionsNew = transactions;
          delete transactionsNew[transaction];
          setTransactions(transactionsNew);
          return;
        }
        let what = json["textroom"];
        if (what === "message") {
          // Incoming message: public or private?
          let msg = escapeXmlTags(json["text"]);
          let from = json["from"];
          let dateString = getDateString(json["date"]);
          let whisper = json["whisper"];
          if (whisper) {
            // Private message
          } else {
            // Public message
          }
        } else if (what === "announcement") {
          // Room announcement
          var msg = escapeXmlTags(json["text"]);
          var dateString = getDateString(json["date"]);
        } else if (what === "join") {
          // Somebody joined
          var username = json["username"];
          var display = json["display"];
          participants[username] = escapeXmlTags(display ? display : username);
          if (username !== myid && !(username in participants)) {
            // Add to the participants list
          }
        } else if (what === "leave") {
          // Somebody left
          var username = json["username"];
          var when = new Date();
          delete participants[username];
        } else if (what === "kicked") {
          // Somebody was kicked
          var username = json["username"];
          var when = new Date();
          delete participants[username];
          if (username === myid) {
            console.log("You have been kicked from the room");
          }
        } else if (what === "destroyed") {
          if (json["room"] !== currentRoom) return;
          // Room was destroyed, goodbye!
          Janus.warn("The room has been destroyed!");
        }
      },
      oncleanup: function () {
        // PeerConnection with the plugin closed, clean the UI
        // The plugin handle is still valid so we can create a new one
      },
      detached: function () {
        // Connection with the plugin closed, get rid of its features
        // The plugin handle is not valid anymore
      },
    };

    console.log("Attached to current session", session);
    session.attach(params);
  };

  // Helper to escape XML tags
  const escapeXmlTags = (value) => {
    if (value) {
      let escapedValue = value.replace(new RegExp("<", "g"), "&lt");
      escapedValue = escapedValue.replace(new RegExp(">", "g"), "&gt");
      return escapedValue;
    }
  };

  // Helper to parse query string
  const getQueryStringValue = (name) => {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    let regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(window.location.search);
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  };

  // Just a helper to generate random usernames
  const randomString = (len, charSet) => {
    charSet =
      charSet ||
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let randomString = "";
    for (let i = 0; i < len; i++) {
      let randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
  };

  // Helper to format times
  const getDateString = (jsonDate) => {
    let when = new Date();
    if (jsonDate) {
      when = new Date(Date.parse(jsonDate));
    }
    let dateString =
      ("0" + when.getUTCHours()).slice(-2) +
      ":" +
      ("0" + when.getUTCMinutes()).slice(-2) +
      ":" +
      ("0" + when.getUTCSeconds()).slice(-2);
    return dateString;
  };

  // Function to send data through data channel
  const sendData = (data) => {
    let pluginHandle = currentPluginHandle;
    if (data === "") {
      // bootbox.alert('Insert a message to send on the DataChannel');
      return;
    }
    let message = {
      textroom: "message",
      transaction: randomString(12),
      room: currentRoom,
      text: data,
    };

    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    pluginHandle.data({
      text: JSON.stringify(message),
      error: (reason) => {
        console.log(reason);
      },
      success: () => {
        // Update message with info
        let messageModel = {
          ...message,
          date: Date.now(),
          whisper: false,
          from: myid,
        };
        // Save message to database
        appendMessage(messageModel);
      },
    });
  };

  // Send a private message to a user
  const sendPrivateMsg = (username, messageBody) => {
    let display = participants[username];
    let pluginHandle = currentPluginHandle;
    if (!display) return;

    if (messageBody && messageBody !== "") {
      let message = {
        textroom: "message",
        transaction: randomString(12),
        room: currentRoom,
        to: username,
        text: messageBody,
      };
      pluginHandle.data({
        text: JSON.stringify(message),
        error: function (reason) {
          // bootbox.alert(reason);
        },
        success: function () {
          // $('#chatroom').append('<p style="color: purple;">[' + getDateString() + '] <b>[whisper to ' + display + ']</b> ' + escapeXmlTags(result));
          // $('#chatroom').get(0).scrollTop = $('#chatroom').get(0).scrollHeight;
        },
      });
    }

    return;
  };

  // const registerUsername = (username) => {
  //   let pluginHandle = currentPluginHandle;
  //   console.log("registerUsername pluginHandle", pluginHandle);
  //   if (username === "") {
  //     return;
  //   }
  //   let transaction = randomString(12);
  //   let register = {
  //     textroom: "join",
  //     transaction: transaction,
  //     room: currentRoom,
  //     username: myid,
  //     display: username,
  //   };
  //   console.log({ register });
  //   setMyUsername(escapeXmlTags(username));
  //   const transactionFunc = (response) => {
  //     console.log({ response });
  //     if (response["textroom"] === "error") {
  //       // Something went wrong
  //       if (response["error_code"] === 417) {
  //         // This is a "no such room" error: give a more meaningful description
  //         // bootbox.alert(
  //         //     "<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
  //         //     "does not exist...</p><p>Do you have an updated <code>janus.plugin.textroom.jcfg</code> " +
  //         //     "configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
  //         //     "from that sample in your current configuration file, then restart Janus and try again."
  //         // );
  //         console.error("No room with that code");
  //       } else {
  //         console.error(response["error"]);
  //       }
  //       return;
  //     }

  //     // We're in

  //     // Any participants already in?
  //     console.log("Participants:", response.participants);
  //     if (response.participants && response.participants.length > 0) {
  //       let joinedParticipants = {};

  //       for (let i in response.participants) {
  //         let p = response.participants[i];

  //         let newParticipantObject = {};
  //         let newParticipantValue = escapeXmlTags(
  //           p.display ? p.display : p.username
  //         );
  //         // newParticipantObject[p.username] = escapeXmlTags(
  //         //   p.display ? p.display : p.username
  //         // );
  //         joinedParticipants = {
  //           ...joinedParticipants,
  //           [p.username]: newParticipantValue,
  //         };

  //         if (p.username !== myid && !(username in participants)) {
  //           // Add to the participants list (UI)

  //           // Send private message as joined participant
  //           sendPrivateMsg(myusername);
  //         }
  //       }

  //       // Add new participants to state
  //       setParticipants((prevParticipants) => {
  //         return {
  //           ...prevParticipants,
  //           ...joinedParticipants,
  //         };
  //       });
  //     }
  //   };

  //   transactionsTemp = {
  //     ...transactions,
  //     [transaction]: transactionFunc,
  //   };

  //   setTransactions((prevTransactions) => {
  //     return {
  //       ...transactions,
  //       [transaction]: transactionFunc,
  //     };
  //   });

  //   pluginHandle.data({
  //     text: JSON.stringify(register),
  //     error: function (reason) {
  //       console.error(reason);
  //     },
  //     success: (res) => {
  //       console.log("JOINED CORRECTLY", res);
  //     },
  //   });
  // };

  const joinRoom = (roomId) => {
    let pluginHandle = currentPluginHandle;
    if (!myusername) {
      return;
    }
    let transaction = randomString(12);
    let join = {
      textroom: "join",
      transaction: transaction,
      room: roomId,
      username: myid,
      display: myusername,
    };
    console.log({ join });

    const transactionFunc = (response) => {
      console.log({ response });
      if (response["textroom"] === "error") {
        // Something went wrong
        if (response["error_code"] === 417) {
          console.error("No room with that code");
        } else if (
          response["error_code"] == 420 ||
          response["error_code"] == 421
        ) {
          console.log("Already logged in");
          setCurrentRoom(roomId);
        } else {
          console.error(response["error"]);
        }
        return;
      }

      // We're in
      setCurrentRoom(roomId);

      // Add to overall participants
      addToRoomParticipants(roomId);

      // Any participants already in?
      console.log("Participants:", response.participants);
      if (response.participants && response.participants.length > 0) {
        let joinedParticipants = {};

        for (let i in response.participants) {
          let p = response.participants[i];

          let newParticipantObject = {};
          let newParticipantValue = escapeXmlTags(
            p.display ? p.display : p.username
          );
          // newParticipantObject[p.username] = escapeXmlTags(
          //   p.display ? p.display : p.username
          // );
          joinedParticipants = {
            ...joinedParticipants,
            [p.username]: newParticipantValue,
          };

          if (p.username !== myid) {
            // Send private message as joined participant
            sendPrivateMsg(p.username);
          }
        }

        // Add new participants to state
        setParticipants((prevParticipants) => {
          return {
            ...prevParticipants,
            ...joinedParticipants,
          };
        });
      }
    };

    transactionsTemp = {
      ...transactions,
      [transaction]: transactionFunc,
    };

    setTransactions((prevTransactions) => {
      return {
        ...transactions,
        [transaction]: transactionFunc,
      };
    });

    pluginHandle.data({
      text: JSON.stringify(join),
      error: function (reason) {
        console.error(reason);
      },
      success: (res) => {
        console.log("JOINED CORRECTLY", res);
      },
    });
  };

  const createRoom = (description = "Room") => {
    let pluginHandle = currentPluginHandle;

    let transaction = randomString(12);
    let create = {
      textroom: "create",
      transaction: transaction,
      history: 0,
      permanent: true,
    };

    descriptionTemp = description;

    const transactionFunc = (response) => {
      console.log({ response });
      if (response["textroom"] === "error") {
        // Something went wrong
        if (response["error_code"] === 417) {
          console.error("No room with that code");
        } else {
          console.error(response["error"]);
        }
        return;
      }

      if (!response["permanent"]) {
        console.error("Could not save to config file: Permissions problems");
        return;
      }

      // Room created correctly
      // setCurrentRoom(response["room"]);
      addUserRoom(response["room"]);

      console.log({ response, descriptionTemp });

      // Add Room to list of rooms
      addRoomToList({
        roomId: response["room"],
        description: descriptionTemp,
      });

      descriptionTemp = "";
    };

    transactionsTemp = {
      ...transactions,
      [transaction]: transactionFunc,
    };

    setTransactions((prevTransactions) => {
      return {
        ...transactions,
        [transaction]: transactionFunc,
      };
    });

    pluginHandle.data({
      text: JSON.stringify(create),
      error: function (reason) {
        console.log({ reason });
        console.error(reason);
      },
      success: (res) => {
        console.log("CREATED ROOM", res);
      },
    });
  };

  return (
    <JanusContext.Provider
      value={{
        currentSession,
        sendData,
        currentRoom,
        transactions,
        participants,
        messages,
        createRoom,
        joinRoom,
      }}
    >
      {children}
    </JanusContext.Provider>
  );
};
