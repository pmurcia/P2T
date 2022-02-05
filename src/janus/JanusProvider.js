import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

  const [feeds, setFeeds] = useState([]);
  const [feedStreams, setFeedStreams] = useState({});
  const [localTracks, setLocalTracks] = useState({});
  const [localVideos, setLocalVideos] = useState(0);
  const [mypvtid, setMyPvtId] = useState(null);
  const [remoteStream, setRemoteStream] = useState();

  let bitrateTimer = useRef(null);

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
        .then((session) => attachVideoRoomPlugin(session))
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
    // let transactionsNow = transactions;
    return new Promise((resolve, reject) => {
      let videoRoom;
      // let transactionsNow;

      let params = {
        plugin: "janus.plugin.videoroom",
        success: function (pluginHandle) {
          // Plugin attached! 'pluginHandle' is our handle
          console.log("pluginHandle", pluginHandle);

          videoRoom = pluginHandle;
          resolve(pluginHandle);

          // console.log("SETUP", { pluginHandle, currentPluginHandle });
          // resolve(videoRoom);
        },
        error: (cause) => {
          // Couldn't attach to the plugin
          console.error(cause);
          reject(cause);
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

          // setCurrentPluginHandle(videoRoom);
          // on ? resolve(videoRoom) : reject(videoRoom);
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
          Janus.debug(" ::: Got a message (publisher) :::", msg);
          let transaction = msg["transaction"];
          console.log("Execute transaction", { transactionsTemp, transaction });

          // Special case of join
          if (
            msg["videoroom"] == "joined" &&
            Object.keys(transactionsTemp).length > 0
          ) {
            let id = Object.keys(transactionsTemp)[0];
            transactionsTemp[id](msg);
            delete transactionsTemp[transaction];
            setTransactions(transactionsTemp);
            return;
          }

          if (transaction && transactionsTemp[transaction]) {
            // Someone was waiting for this
            // let transactionsNew = transactions;
            transactionsTemp[transaction](msg);
            delete transactionsTemp[transaction];
            // delete transactionsNew[transaction];
            setTransactions(transactionsTemp);

            return;
          }
          let event = msg["videoroom"];
          Janus.debug("Event: " + event);
          if (event) {
            if (event === "joined") {
              // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
              // myid = msg["id"];
              // mypvtid = msg["private_id"];
              setMyPvtId(msg["private_id"]);
              // Janus.log(
              //   "Successfully joined room " + msg["room"] + " with ID " + myid
              // );
              // if (subscriber_mode) {
              //   // $("#videojoin").hide();
              //   // $("#videos").removeClass("hide").show();
              // } else {
              // console.log({ currentPluginHandle, videoRoom });
              // publishOwnFeed(true, true);
              // }
              // Any new feed to attach to?
              if (msg["publishers"]) {
                let list = msg["publishers"];
                Janus.debug("Got a list of available publishers/feeds:", list);
                for (let f in list) {
                  let id = list[f]["id"];
                  let display = list[f]["display"];
                  let streams = list[f]["streams"];
                  for (let i in streams) {
                    let stream = streams[i];
                    stream["id"] = id;
                    stream["display"] = display;
                  }
                  // feedStreams[id] = streams;
                  setFeedStreams((prev) => {
                    return { ...prev, [id]: streams };
                  });
                  Janus.debug("  >> [" + id + "] " + display + ":", streams);
                  newRemoteFeed(id, display, streams);
                }
              }
            } else if (event === "destroyed") {
              // The room has been destroyed
              Janus.warn("The room has been destroyed!");
              // bootbox.alert("The room has been destroyed", function () {
              //   window.location.reload();
              // });
            } else if (event === "event") {
              // Any info on our streams or a new feed to attach to?
              if (msg["streams"]) {
                let streams = msg["streams"];
                for (let i in streams) {
                  let stream = streams[i];
                  stream["id"] = myid;
                  stream["display"] = myusername;
                }
                // feedStreams[myid] = streams;
                setFeedStreams((prev) => {
                  return {
                    ...prev,
                    [myid]: streams,
                  };
                });
              } else if (msg["publishers"]) {
                let list = msg["publishers"];
                Janus.debug("Got a list of available publishers/feeds:", list);
                for (let f in list) {
                  let id = list[f]["id"];
                  let display = list[f]["display"];
                  let streams = list[f]["streams"];
                  for (let i in streams) {
                    let stream = streams[i];
                    stream["id"] = id;
                    stream["display"] = display;
                  }
                  // feedStreams[id] = streams;
                  setFeedStreams((prev) => {
                    return {
                      ...prev,
                      [id]: streams,
                    };
                  });
                  Janus.debug("  >> [" + id + "] " + display + ":", streams);
                  newRemoteFeed(id, display, streams);
                }
              } else if (msg["leaving"]) {
                // One of the publishers has gone away?
                let leaving = msg["leaving"];
                Janus.log("Publisher left: " + leaving);
                let remoteFeed = null;
                for (let i = 1; i < 6; i++) {
                  if (feeds[i] && feeds[i].rfid == leaving) {
                    remoteFeed = feeds[i];
                    break;
                  }
                }
                if (remoteFeed) {
                  Janus.debug(
                    "Feed " +
                      remoteFeed.rfid +
                      " (" +
                      remoteFeed.rfdisplay +
                      ") has left the room, detaching"
                  );
                  // $("#remote" + remoteFeed.rfindex)
                  //   .empty()
                  //   .hide();
                  // $("#videoremote" + remoteFeed.rfindex).empty();
                  // feeds[remoteFeed.rfindex] = null;
                  setFeeds((prev) => {
                    let newFeeds = prev;
                    newFeeds[remoteFeed.rfindex] = null;
                    return [...newFeeds];
                  });
                  remoteFeed.detach();
                }
                // delete feedStreams[leaving];
                setFeedStreams((prev) => {
                  let newFeedStreams = prev;
                  delete newFeedStreams[leaving];
                  return {
                    ...newFeedStreams,
                  };
                });
              } else if (msg["unpublished"]) {
                // One of the publishers has unpublished?
                let unpublished = msg["unpublished"];
                Janus.log("Publisher left: " + unpublished);
                if (unpublished === "ok") {
                  // That's us
                  videoRoom.hangup();
                  return;
                }
                let remoteFeed = null;
                for (let i = 1; i < 6; i++) {
                  if (feeds[i] && feeds[i].rfid == unpublished) {
                    remoteFeed = feeds[i];
                    break;
                  }
                }
                if (remoteFeed) {
                  Janus.debug(
                    "Feed " +
                      remoteFeed.rfid +
                      " (" +
                      remoteFeed.rfdisplay +
                      ") has left the room, detaching"
                  );
                  // $("#remote" + remoteFeed.rfindex)
                  //   .empty()
                  //   .hide();
                  // $("#videoremote" + remoteFeed.rfindex).empty();
                  // feeds[remoteFeed.rfindex] = null;
                  setFeeds((prev) => {
                    let newFeeds = prev;
                    newFeeds[remoteFeed.rfindex] = null;
                    return [...newFeeds];
                  });
                  remoteFeed.detach();
                }
                // delete feedStreams[unpublished];
                setFeedStreams((prev) => {
                  let newFeedStreams = prev;
                  delete newFeedStreams[unpublished];
                  return {
                    ...newFeedStreams,
                  };
                });
              } else if (msg["error"]) {
                if (msg["error_code"] === 426) {
                  // This is a "no such room" error: give a more meaningful description
                  // bootbox.alert(
                  //   "<p>Apparently room <code>" +
                  //     myroom +
                  //     "</code> (the one this demo uses as a test room) " +
                  //     "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                  //     "configuration file? If not, make sure you copy the details of room <code>" +
                  //     myroom +
                  //     "</code> " +
                  //     "from that sample in your current configuration file, then restart Janus and try again."
                  // );
                } else {
                  // bootbox.alert(msg["error"]);
                }
              }
            }
          }
          if (jsep) {
            // Answer
            // videoRoom.createAnswer({
            //   jsep: jsep,
            //   media: { audio: false, video: false, data: true },
            //   success: function (jsep) {
            //     Janus.debug("Got SDP!", jsep);
            //     let body = { request: "ack" };
            //     videoRoom.send({ message: body, jsep: jsep });
            //   },
            //   error: function (error) {
            //     Janus.error("WebRTC error:", error);
            //   },
            // });
            videoRoom.handleRemoteJsep({ jsep: jsep });
          }
        },
        onlocaltrack: function (track, on) {
          Janus.debug("Local track " + (on ? "added" : "removed") + ":", track);
          // We use the track ID as name of the element, but it may contain invalid characters
          var trackId = track.id.replace(/[{}]/g, "");
          if (!on) {
            // Track removed, get rid of the stream and the rendering
            let stream = localTracks[trackId];
            if (stream) {
              try {
                let tracks = stream.getTracks();
                for (let i in tracks) {
                  let mst = tracks[i];
                  if (mst !== null && mst !== undefined) mst.stop();
                }
              } catch (e) {}
            }
            if (track.kind === "video") {
              // $("#myvideo" + trackId).remove();
              // localVideos--;
              setLocalVideos(localVideos--);
              if (localVideos === 0) {
                // No video, at least for now: show a placeholder
                // if ($("#videolocal .no-video-container").length === 0) {
                //   $("#videolocal").append(
                //     '<div class="no-video-container">' +
                //       '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                //       '<span class="no-video-text">No webcam available</span>' +
                //       "</div>"
                //   );
                // }
              }
            }
            delete localTracks[trackId];
            setLocalTracks((prev) => {
              let newLocalTracks = prev;
              delete newLocalTracks[trackId];
              return {
                ...newLocalTracks,
              };
            });
            return;
          }
          // If we're here, a new track was added
          let stream = localTracks[trackId];
          if (stream) {
            // We've been here already
            return;
          }
          // $("#videos").removeClass("hide").show();
          // if ($("#mute").length === 0) {
          //   // Add a 'mute' button
          //   $("#videolocal").append(
          //     '<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>'
          //   );
          //   $("#mute").click(toggleMute);
          //   // Add an 'unpublish' button
          //   $("#videolocal").append(
          //     '<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>'
          //   );
          //   $("#unpublish").click(unpublishOwnFeed);
          // }
          if (track.kind === "audio") {
            // We ignore local audio tracks, they'd generate echo anyway
            if (localVideos === 0) {
              // No video, at least for now: show a placeholder
              // if ($("#videolocal .no-video-container").length === 0) {
              //   $("#videolocal").append(
              //     '<div class="no-video-container">' +
              //       '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
              //       '<span class="no-video-text">No webcam available</span>' +
              //       "</div>"
              //   );
              // }
            }
          } else {
            // New video track: create a stream out of it
            // localVideos++;
            setLocalVideos(localVideos++);
            // $("#videolocal .no-video-container").remove();
            stream = new MediaStream();
            stream.addTrack(track.clone());
            // localTracks[trackId] = stream;
            setLocalTracks((prev) => {
              return {
                ...prev,
                [trackId]: stream,
              };
            });
            Janus.log("Created local stream:", stream);
            Janus.log(stream.getTracks());
            Janus.log(stream.getVideoTracks());
            // $("#videolocal").append(
            //   '<video class="rounded centered" id="myvideo' +
            //     trackId +
            //     '" width=100% autoplay playsinline muted="muted"/>'
            // );
            // TODO Attach media stream to a video element
            // Janus.attachMediaStream($("#myvideo" + trackId).get(0), stream);
          }
          if (
            videoRoom.webrtcStuff.pc.iceConnectionState !== "completed" &&
            videoRoom.webrtcStuff.pc.iceConnectionState !== "connected"
          ) {
            // $("#videolocal")
            //   .parent()
            //   .parent()
            //   .block({
            //     message: "<b>Publishing...</b>",
            //     css: {
            //       border: "none",
            //       backgroundColor: "transparent",
            //       color: "white",
            //     },
            //   });
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
  // TODO change to videoroom plugin (probably only name change)
  const sendData = (data) => {
    let pluginHandle = currentPluginHandle;
    if (data === "") {
      // bootbox.alert('Insert a message to send on the DataChannel');
      return;
    }
    let json = {
      textroom: "message",
      transaction: randomString(12),
      room: currentRoom,
      text: data,
    };

    console.log({ json, data });

    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    pluginHandle.data({
      text: JSON.stringify(json),
      error: (reason) => {
        console.log(reason);
      },
      success: () => {
        let messageModel = {
          ...json,
        };
        let what = json["textroom"];

        // Update message with info
        if (what === "message") {
          // Incoming message: public or private?
          let msg = escapeXmlTags(json["text"]);
          let from = myid;
          let dateString = Date.now();
          let whisper = false;
          // Public message
          console.log("Public message", msg);

          // Prepare message to save to database
          messageModel = {
            ...messageModel,
            date: dateString,
            from: from,
            whisper: whisper,
          };

          // Save to current messages
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
        }

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

  const joinVideoRoom = (roomId) => {
    let pluginHandle = currentPluginHandle;
    if (!myusername) {
      return;
    }
    let transaction = randomString(12);
    let join = {
      request: "join",
      transaction: transaction,
      room: roomId,
      // id: myid,
      display: myusername,
      ptype: "publisher",
    };
    console.log({ join });

    const transactionFunc = (response) => {
      console.log({ response });
      if (response["videoroom"] === "event") {
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

      // Add myself to overall participants
      addToRoomParticipants(roomId, {
        videoRoomId: response["id"],
        videoRoomPrivateId: response["private_id"],
      });

      // TODO needed???
      // Any participants already in?
      console.log("Participants:", response.attendees);
      if (response?.participants && response?.participants?.length > 0) {
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

    pluginHandle.send({
      message: join,
      transaction: transaction,
      error: function (reason) {
        console.error(reason);
      },
      success: (res) => {
        console.log("JOINED CORRECTLY", res);
      },
    });
  };

  const createVideoRoom = (description = "Room") => {
    let pluginHandle = currentPluginHandle;

    console.log({ pluginHandle, currentPluginHandle });

    let create = {
      request: "create",
      permanent: true,
      is_private: true,
    };

    descriptionTemp = description;

    const transactionFunc = (response) => {
      console.log({ response });
      if (response["videoroom"] === "error") {
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

    pluginHandle.send({
      message: create,
      success: transactionFunc,
    });
  };

  const publishOwnFeed = (useAudio, useVideo) => {
    let pluginHandle = currentPluginHandle;

    console.log({ useAudio, useVideo, pluginHandle, currentPluginHandle });

    // Publish our stream
    // $("#publish").attr("disabled", true).unbind("click");
    pluginHandle.createOffer({
      // Add data:true here if you want to publish datachannels as well
      media: {
        audioRecv: false,
        videoRecv: false,
        audioSend: useAudio,
        videoSend: useVideo,
        data: true,
      }, // Publishers are sendonly
      // If you want to test simulcasting (Chrome and Firefox only), then
      // pass a ?simulcast=true when opening this demo page: it will turn
      // the following 'simulcast' property to pass to janus.js to true
      // simulcast: doSimulcast,
      // simulcast2: doSimulcast2,
      // customizeSdp: function (jsep) {
      //   // If DTX is enabled, munge the SDP
      //   if (doDtx) {
      //     jsep.sdp = jsep.sdp.replace(
      //       "useinbandfec=1",
      //       "useinbandfec=1;usedtx=1"
      //     );
      //   }
      // },
      success: function (jsep) {
        Janus.debug("Got publisher SDP!", jsep);
        let publish = {
          request: "configure",
          audio: useAudio,
          video: useVideo,
        };
        // You can force a specific codec to use when publishing by using the
        // audiocodec and videocodec properties, for instance:
        // 		publish["audiocodec"] = "opus"
        // to force Opus as the audio codec to use, or:
        // 		publish["videocodec"] = "vp9"
        // to force VP9 as the videocodec to use. In both case, though, forcing
        // a codec will only work if: (1) the codec is actually in the SDP (and
        // so the browser supports it), and (2) the codec is in the list of
        // allowed codecs in a room. With respect to the point (2) above,
        // refer to the text in janus.plugin.videoroom.jcfg for more details.
        // We allow people to specify a codec via query string, for demo purposes
        // if (acodec) publish["audiocodec"] = acodec;
        // if (vcodec) publish["videocodec"] = vcodec;
        pluginHandle.send({
          message: publish,
          jsep: jsep,
        });
      },
      error: function (error) {
        Janus.error("WebRTC error:", error);
        if (useAudio) {
          publishOwnFeed(false, true);
        } else {
          console.error("WebRTC error... " + error.message);
        }
      },
    });
  };

  const unpublishOwnFeed = () => {
    let pluginHandle = currentPluginHandle;

    let unpublish = {
      request: "unpublish",
      transaction: randomString(12),
    };
    pluginHandle.send({ message: unpublish });
  };

  const newRemoteFeed = (id, display, streams) => {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    let remoteFeed = null;
    if (!streams) streams = feedStreams[id];
    currentSession.attach({
      plugin: "janus.plugin.videoroom",
      success: function (pluginHandle) {
        remoteFeed = pluginHandle;
        remoteFeed.remoteTracks = {};
        remoteFeed.remoteVideos = 0;
        remoteFeed.simulcastStarted = false;
        Janus.log(
          "Plugin attached! (" +
            remoteFeed.getPlugin() +
            ", id=" +
            remoteFeed.getId() +
            ")"
        );
        Janus.log("  -- This is a subscriber");
        // Prepare the streams to subscribe to, as an array: we have the list of
        // streams the feed is publishing, so we can choose what to pick or skip
        let subscription = [];
        for (let i in streams) {
          let stream = streams[i];
          // If the publisher is VP8/VP9 and this is an older Safari, let's avoid video
          if (
            stream.type === "video" &&
            Janus.webRTCAdapter.browserDetails.browser === "safari" &&
            (stream.codec === "vp9" ||
              (stream.codec === "vp8" && !Janus.safariVp8))
          ) {
            // toastr.warning(
            //   "Publisher is using " +
            //     stream.codec.toUpperCase +
            //     ", but Safari doesn't support it: disabling video stream #" +
            //     stream.mindex
            // );
            continue;
          }
          subscription.push({
            feed: stream.id, // This is mandatory
            mid: stream.mid, // This is optional (all streams, if missing)
          });
          // FIXME Right now, this is always the same feed: in the future, it won't
          remoteFeed.rfid = stream.id;
          remoteFeed.rfdisplay = escapeXmlTags(stream.display);
        }
        // We wait for the plugin to send us an offer
        let subscribe = {
          request: "join",
          room: currentRoom,
          ptype: "subscriber",
          streams: subscription,
          private_id: mypvtid,
        };

        console.log({ currentRoom, subscribe });
        remoteFeed.send({ message: subscribe });
      },
      error: function (error) {
        Janus.error("  -- Error attaching plugin...", error);
        // bootbox.alert("Error attaching plugin... " + error);
      },
      iceState: function (state) {
        Janus.log(
          "ICE state (feed #" + remoteFeed.rfindex + ") changed to " + state
        );
      },
      webrtcState: function (on) {
        Janus.log(
          "Janus says this WebRTC PeerConnection (feed #" +
            remoteFeed.rfindex +
            ") is " +
            (on ? "up" : "down") +
            " now"
        );
      },
      slowLink: function (uplink, lost, mid) {
        Janus.warn(
          "Janus reports problems " +
            (uplink ? "sending" : "receiving") +
            " packets on mid " +
            mid +
            " (" +
            lost +
            " lost packets)"
        );
      },
      onmessage: function (msg, jsep) {
        Janus.debug(" ::: Got a message (subscriber) :::", msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if (msg["error"]) {
          // bootbox.alert(msg["error"]);
          console.error(msg["error"]);
        } else if (event) {
          if (event === "attached") {
            let tempFeeds = feeds;
            // Subscriber created and attached
            for (let i = 1; i < 6; i++) {
              if (!tempFeeds[i]) {
                tempFeeds[i] = remoteFeed;
                remoteFeed.rfindex = i;
                break;
              }
            }

            setFeeds(tempFeeds);
            if (!remoteFeed.spinner) {
              // var target = document.getElementById(
              //   "videoremote" + remoteFeed.rfindex
              // );
              // remoteFeed.spinner = new Spinner({ top: 100 }).spin(target);
            } else {
              // remoteFeed.spinner.spin();
            }
            Janus.log("Successfully attached to feed in room " + msg["room"]);
            // $("#remote" + remoteFeed.rfindex)
            //   .removeClass("hide")
            //   .html(remoteFeed.rfdisplay)
            //   .show();
          } else if (event === "event") {
            // Check if we got a simulcast-related event from this publisher
            let substream = msg["substream"];
            let temporal = msg["temporal"];
            if (
              (substream !== null && substream !== undefined) ||
              (temporal !== null && temporal !== undefined)
            ) {
              if (!remoteFeed.simulcastStarted) {
                remoteFeed.simulcastStarted = true;
                // Add some new buttons
                // addSimulcastButtons(remoteFeed.rfindex, true);
              }
              // We just received notice that there's been a switch, update the buttons
              // updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
            }
          } else {
            // What has just happened?
          }
        }
        if (jsep) {
          Janus.debug("Handling SDP as well...", jsep);
          let stereo = jsep.sdp.indexOf("stereo=1") !== -1;
          // Answer and attach
          remoteFeed.createAnswer({
            jsep: jsep,
            // Add data:true here if you want to subscribe to datachannels as well
            // (obviously only works if the publisher offered them in the first place)
            media: { audioSend: false, videoSend: false, data: true }, // We want recvonly audio/video
            customizeSdp: function (jsep) {
              if (stereo && jsep.sdp.indexOf("stereo=1") == -1) {
                // Make sure that our offer contains stereo too
                jsep.sdp = jsep.sdp.replace(
                  "useinbandfec=1",
                  "useinbandfec=1;stereo=1"
                );
              }
            },
            success: function (jsep) {
              Janus.debug("Got SDP!", jsep);
              let body = { request: "start", room: currentRoom };
              remoteFeed.send({
                message: body,
                jsep: jsep,
              });
            },
            error: function (error) {
              Janus.error("WebRTC error:", error);
              // bootbox.alert("WebRTC error... " + error.message);
            },
          });
        }
      },
      onlocaltrack: function (track, on) {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      onremotetrack: function (track, mid, on) {
        Janus.debug(
          "Remote feed #" +
            remoteFeed.rfindex +
            ", remote track (mid=" +
            mid +
            ") " +
            (on ? "added" : "removed") +
            ":",
          track
        );
        if (!on) {
          // Track removed, get rid of the stream and the rendering
          let stream = remoteFeed.remoteTracks[mid];
          if (stream) {
            try {
              let tracks = stream.getTracks();
              for (let i in tracks) {
                let mst = tracks[i];
                if (mst !== null && mst !== undefined) mst.stop();
              }
            } catch (e) {}
          }
          // $("#remotevideo" + remoteFeed.rfindex + "-" + mid).remove();
          if (track.kind === "video") {
            remoteFeed.remoteVideos--;
            if (remoteFeed.remoteVideos === 0) {
              // No video, at least for now: show a placeholder
              // if (
              //   $("#videoremote" + remoteFeed.rfindex + " .no-video-container")
              //     .length === 0
              // ) {
              //   $("#videoremote" + remoteFeed.rfindex).append(
              //     '<div class="no-video-container">' +
              //       '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
              //       '<span class="no-video-text">No remote video available</span>' +
              //       "</div>"
              //   );
              // }
            }
          }
          delete remoteFeed.remoteTracks[mid];
          return;
        }
        // If we're here, a new track was added
        if (remoteFeed.spinner) {
          remoteFeed.spinner.stop();
          remoteFeed.spinner = null;
        }
        // if ($("#remotevideo" + remoteFeed.rfindex + "-" + mid).length > 0)
        //   return;
        if (track.kind === "audio") {
          // New audio track: create a stream out of it, and use a hidden <audio> element
          let stream = new MediaStream();
          stream.addTrack(track.clone());
          remoteFeed.remoteTracks[mid] = stream;
          Janus.log("Created remote audio stream:", stream);
          // $("#videoremote" + remoteFeed.rfindex).append(
          //   '<audio class="hide" id="remotevideo' +
          //     remoteFeed.rfindex +
          //     "-" +
          //     mid +
          //     '" autoplay playsinline/>'
          // );
          // TODO Attach media stream to a video element
          // Janus.attachMediaStream(
          //   $("#remotevideo" + remoteFeed.rfindex + "-" + mid).get(0),
          //   stream
          // );
          setRemoteStream(stream);
          if (remoteFeed.remoteVideos === 0) {
            // No video, at least for now: show a placeholder
            // if (
            //   $("#videoremote" + remoteFeed.rfindex + " .no-video-container")
            //     .length === 0
            // ) {
            //   $("#videoremote" + remoteFeed.rfindex).append(
            //     '<div class="no-video-container">' +
            //       '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
            //       '<span class="no-video-text">No remote video available</span>' +
            //       "</div>"
            //   );
            // }
          }
        } else {
          // New video track: create a stream out of it
          remoteFeed.remoteVideos++;
          // $(
          //   "#videoremote" + remoteFeed.rfindex + " .no-video-container"
          // ).remove();
          let stream = new MediaStream();
          stream.addTrack(track.clone());
          remoteFeed.remoteTracks[mid] = stream;
          Janus.log("Created remote video stream:", stream);
          // $("#videoremote" + remoteFeed.rfindex).append(
          //   '<video class="rounded centered" id="remotevideo' +
          //     remoteFeed.rfindex +
          //     "-" +
          //     mid +
          //     '" width=100% autoplay playsinline/>'
          // );
          // $("#videoremote" + remoteFeed.rfindex).append(
          //   '<span class="label label-primary hide" id="curres' +
          //     remoteFeed.rfindex +
          //     '" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
          //     '<span class="label label-info hide" id="curbitrate' +
          //     remoteFeed.rfindex +
          //     '" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>'
          // );
          // TODO Attach media stream to a video element
          // Janus.attachMediaStream(
          //   $("#remotevideo" + remoteFeed.rfindex + "-" + mid).get(0),
          //   stream
          // );
          setRemoteStream(stream);
          // Note: we'll need this for additional videos too
          if (!bitrateTimer[remoteFeed.rfindex]) {
            // $("#curbitrate" + remoteFeed.rfindex)
            //   .removeClass("hide")
            //   .show();
            bitrateTimer[remoteFeed.rfindex] = setInterval(function () {
              // if (!$("#videoremote" + remoteFeed.rfindex + " video").get(0))
              //   return;
              // Display updated bitrate, if supported
              let bitrate = remoteFeed.getBitrate();
              // $("#curbitrate" + remoteFeed.rfindex).text(bitrate);
              // // Check if the resolution changed too
              // let width = $("#videoremote" + remoteFeed.rfindex + " video").get(
              //   0
              // ).videoWidth;
              // let height = $(
              //   "#videoremote" + remoteFeed.rfindex + " video"
              // ).get(0).videoHeight;
              // if (width > 0 && height > 0)
              //   $("#curres" + remoteFeed.rfindex)
              //     .removeClass("hide")
              //     .text(width + "x" + height)
              //     .show();
            }, 1000);
          }
        }
      },
      oncleanup: function () {
        Janus.log(
          " ::: Got a cleanup notification (remote feed " + id + ") :::"
        );
        if (remoteFeed.spinner) remoteFeed.spinner.stop();
        remoteFeed.spinner = null;
        // $("#remotevideo" + remoteFeed.rfindex).remove();
        // $("#waitingvideo" + remoteFeed.rfindex).remove();
        // $("#novideo" + remoteFeed.rfindex).remove();
        // $("#curbitrate" + remoteFeed.rfindex).remove();
        // $("#curres" + remoteFeed.rfindex).remove();
        if (bitrateTimer[remoteFeed.rfindex])
          clearInterval(bitrateTimer[remoteFeed.rfindex]);
        bitrateTimer[remoteFeed.rfindex] = null;
        remoteFeed.simulcastStarted = false;
        // $("#simulcast" + remoteFeed.rfindex).remove();
        remoteFeed.remoteTracks = {};
        remoteFeed.remoteVideos = 0;
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
        joinVideoRoom,
        createVideoRoom,
        publishOwnFeed,
        unpublishOwnFeed,
        remoteStream,
        localTracks,
      }}
    >
      {children}
    </JanusContext.Provider>
  );
};
