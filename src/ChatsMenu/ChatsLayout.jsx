import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  Divider,
  TextField,
  IconButton,
  Button,
  ListItemAvatar,
  CircularProgress,
  Modal,
  Box,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { makeStyles } from "@mui/styles";
import { JanusContext } from "../janus/JanusProvider";
import Message from "../Chats/Message";
import { AuthContext } from "../firebase/AuthProvider";
import { DatabaseContext } from "../firebase/DatabaseProvider";
import ProfileMenu from "./ProfileMenu";

const useStyles = makeStyles({
  table: {
    minWidth: 650,
  },
  chatSection: {
    width: "100%",
    height: "100vh",
  },
  headBG: {
    backgroundColor: "#e0e0e0",
  },
  borderRight500: {
    borderRight: "1px solid #e0e0e0",
  },
  borderLeft500: {
    borderLeft: "1px solid #e0e0e0",
    height: "100vh",
  },
  messageArea: {
    minHeight: "80vh",
    overflowY: "auto",
  },
});

export default function ChatsLayout() {
  const {
    currentSession,
    sendData,
    messages,
    currentRoom,
    participants,
    joinRoom,
    joinVideoRoom,
    publishOwnFeed,
    unpublishOwnFeed,
  } = useContext(JanusContext);
  const { user } = useContext(AuthContext);
  const {
    addToQueue,
    isMyTurn,
    removeFromQueue,
    isOnQueue,
    roomsInfo,
    usersInfo,
  } = useContext(DatabaseContext);

  const [canTalk, setCanTalk] = useState(false);
  const [myRooms, setMyRooms] = useState();

  let messageInput = useRef(null);
  let messagesEnd = useRef();
  let talkTimerRef = useRef(null);

  const classes = useStyles();

  useEffect(() => {
    // Clear interval when the component unmounts
    return () => clearTimeout(talkTimerRef.current);
  });

  useEffect(() => {
    console.log("UPDATED ROOMS INFO IN CHATS LAYOUT", isMyTurn(currentRoom));
    console.log("ROOMS INFO IN CHATS LAYOUT", { roomsInfo, currentRoom });
    setCanTalk(isMyTurn(currentRoom));
  }, [roomsInfo]);

  useEffect(() => {
    console.log(`CAN${canTalk ? "" : "NOT"} TALK`);
    if (canTalk) {
      talkTimerRef.current = setTimeout(() => {
        console.log("You took to much time to finish");
        unpublishOwnFeed();
        removeFromQueue(currentRoom);
      }, 20000);
    } else {
      clearTimeout(talkTimerRef.current);
    }
  }, [canTalk]);

  useEffect(() => {
    console.log("Chat messages", messages);
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let rooms = usersInfo[user.uid]?.rooms;
    console.log({ rooms });
    if (rooms) {
      setMyRooms(Object.values(rooms));
    }
  }, [usersInfo]);

  const scrollToBottom = () => {
    messagesEnd.scrollIntoView({ behavior: "smooth" });
  };

  // Send message
  const handleClick = (e) => {
    publishOwnFeed(true, true);
    // console.log("Sending message");
    // let message = messageInput.current.value;
    // if (message) {
    //   console.log(message);
    //   // Send message
    //   sendData(message);
    //   removeFromQueue(currentRoom);
    //   // Message sent
    //   messageInput.current.value = "";
    // }
  };

  const handleActivityClick = (e) => {
    console.log("Checking for queue");
    let onQueue = isOnQueue(currentRoom);
    if (!onQueue) {
      addToQueue(currentRoom);
    } else {
      console.log("Already on queue");
    }
  };

  // Send message when pressed enter
  const checkEnter = (e) => {
    let theCode = e.keyCode ? e.keyCode : e.which ? e.which : e.charCode;
    if (theCode == 13) {
      handleClick();
    } else {
      clearTimeout(talkTimerRef.current);
      talkTimerRef.current = setTimeout(() => {
        console.log("You took to much time to finish");
        unpublishOwnFeed();
        removeFromQueue(currentRoom);
      }, 20000);
    }
  };

  // Get queue for all participants in a room, whether on queue or not
  const getQueueInfo = () => {
    let queue = roomsInfo[currentRoom]?.queue;
    let initial = [];

    console.log({ participants, queue });

    // Add information about queue order
    for (let p in participants) {
      let indexInQueue = -1;
      console.log({ p, queue });
      if (queue) indexInQueue = Object.values(queue)?.indexOf(p);

      console.log({ p, indexInQueue });

      if (indexInQueue < 0) indexInQueue = Object.keys(participants).length + 1;
      console.log({ p, indexInQueue });

      initial = [
        ...initial,
        {
          queuePos: indexInQueue + 1,
          queueUserDisplay: participants[p],
          queueUserId: p,
        },
      ];
    }

    let initialSorted = initial.sort((a, b) => {
      return a.queuePos - b.queuePos;
    });

    // Assing UI positions on list
    // let finalOrder = initialOrder.map(
    //   (item) => {
    //     this.acc++;
    //     return {
    //       ...item,
    //       listKey: this.acc,
    //     };
    //   },
    //   { acc: 1 }
    // );

    let final = [];
    initialSorted.forEach((item) => {
      let lastPos = Object.keys(participants).length + 1;
      if (item.queuePos >= lastPos) {
        item.queuePos = null;
      }

      final = [...final, item];
    });

    console.log({ final });

    return final;
  };

  return (
    <>
      <div>
        <Grid container component={Paper} className={classes.chatSection}>
          <Grid item xs={3} className={classes.borderRight500}>
            <ProfileMenu user={user} />

            <Divider />

            {/* Search function */}
            <Grid item xs={12} style={{ padding: "10px" }}>
              <TextField
                id="outlined-basic-email"
                label="Search"
                variant="outlined"
                fullWidth
              />
            </Grid>

            <Divider />

            {/* Join or create buttons */}
            <Grid container item xs={12} style={{ padding: "10px" }}>
              <Grid item xs={6} style={{ padding: "10px" }}>
                <CreateRoomButton />
              </Grid>

              <Grid item xs={6} style={{ padding: "10px" }} align="right">
                <JoinRoomButton />
              </Grid>
            </Grid>

            <Divider />

            {/* Rooms that user joined */}
            <List>
              {myRooms
                ? myRooms.map((roomId) => {
                    let roomDetail = roomsInfo[roomId];
                    return (
                      <ListItem
                        button
                        key={roomId}
                        onClick={() => joinVideoRoom(roomId)}
                      >
                        <ListItemIcon>
                          <Avatar
                            alt={roomDetail?.description || `Room ${roomId}`}
                            src="https://material-ui.com/static/images/avatar/1.jpg"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={roomDetail?.description || `Room ${roomId}`}
                        >
                          {roomDetail?.description || `Room ${roomId}`}
                        </ListItemText>
                      </ListItem>
                    );
                  })
                : null}
            </List>
          </Grid>

          <Grid item xs={7}>
            {/**** Message History *****/}
            <List className={classes.messageArea}>
              {messages &&
                messages.map(({ text, author, timestamp }, index) => (
                  <ListItem key={index} autoFocus={index === messages.length}>
                    <Message author={author} timestamp={timestamp}>
                      {text}
                    </Message>
                  </ListItem>
                ))}
              <div
                style={{ float: "left", clear: "both" }}
                ref={(el) => {
                  messagesEnd = el;
                }}
              ></div>
            </List>

            <Divider />

            <Grid container style={{ padding: "20px" }}>
              {canTalk && (
                <>
                  <Grid item xs={11}>
                    <TextField
                      id="message-text"
                      placeholder="Enter message"
                      fullWidth
                      inputRef={messageInput}
                      onKeyPress={checkEnter}
                      disabled={!canTalk}
                      autoFocus={canTalk}
                    />
                  </Grid>
                  <Grid item xs={1} align="right">
                    <IconButton
                      variant="contained"
                      color="primary"
                      aria-label="add"
                      onClick={handleClick}
                    >
                      <SendIcon />
                    </IconButton>
                  </Grid>
                </>
              )}
              {!canTalk && (
                <>
                  <Button
                    variant="contained"
                    color={isOnQueue(currentRoom) ? "warning" : "primary"}
                    aria-label="request-write"
                    onClick={handleActivityClick}
                    fullWidth
                  >
                    {isOnQueue(currentRoom) ? (
                      <>
                        <CircularProgress
                          sx={{
                            color: "white",
                          }}
                        />
                      </>
                    ) : (
                      "Request to talk"
                    )}
                  </Button>
                </>
              )}
            </Grid>
          </Grid>

          <Grid item xs={2} className={classes.borderLeft500}>
            <Typography variant="h5">Participants</Typography>

            <Divider />

            {/* Queue for speaking */}
            <List>
              {participants && (
                <>
                  {getQueueInfo().map(
                    ({ queuePos, queueUserDisplay, queueUserId }, key) => (
                      <ListItem key={key}>
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: queuePos ? "primary.main" : "default",
                            }}
                          >
                            {queuePos ? queuePos : "-"}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={queueUserDisplay}
                          secondary={queueUserId == user.uid ? "(me)" : ""}
                        ></ListItemText>
                      </ListItem>
                    )
                  )}
                </>
              )}
            </List>
          </Grid>
        </Grid>
      </div>
    </>
  );
}

function ModalDialog({ open }) {
  return (
    <Modal
      open={open}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box>
        <Typography id="modal-modal-title" variant="h6" component="h2">
          Text in a modal
        </Typography>
        <Typography id="modal-modal-description" sx={{ mt: 2 }}>
          Duis mollis, est non commodo luctus, nisi erat porttitor ligula.
        </Typography>
      </Box>
    </Modal>
  );
}

function CreateRoomButton() {
  const { createRoom, createVideoRoom } = useContext(JanusContext);
  const handleClick = () => {
    createVideoRoom();
  };

  return (
    <Button
      variant="contained"
      color="success"
      aria-label="create-room"
      fullWidth
      onClick={handleClick}
    >
      Create
    </Button>
  );
}

function JoinRoomButton() {
  const handleClick = () => {
    console.log("JOIN ROOM");
  };

  return (
    <Button
      variant="contained"
      color="primary"
      aria-label="join-room"
      fullWidth
      onClick={handleClick}
    >
      Join
    </Button>
  );
}
