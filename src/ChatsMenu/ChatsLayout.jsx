import React, {
  createRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  Fab,
  IconButton,
  Button,
  ListItemAvatar,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { makeStyles } from "@mui/styles";
import { JanusContext } from "../janus/JanusProvider";
import Message from "../Chats/Message";
import { AuthContext } from "../firebase/AuthProvider";
import { DatabaseContext } from "../firebase/DatabaseProvider";

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
  const { currentSession, sendData, messages, currentRoom, participants } =
    useContext(JanusContext);
  const { user } = useContext(AuthContext);
  const { addToQueue, isMyTurn, removeFromQueue, isOnQueue, roomsInfo } =
    useContext(DatabaseContext);
  const [sessionId, setSessionId] = useState(0);
  const [canTalk, setCanTalk] = useState(false);

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
        removeFromQueue(currentRoom);
      }, 10000);
    } else {
      clearTimeout(talkTimerRef.current);
    }
  }, [canTalk]);

  useEffect(() => {
    console.log("Value", currentSession);
    if (currentSession?.getSessionId())
      setSessionId(currentSession.getSessionId());
  }, [currentSession]);

  useEffect(() => {
    console.log("Chat messages", messages);
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEnd.scrollIntoView({ behavior: "smooth" });
  };

  // Send message
  const handleClick = (e) => {
    console.log("Sending message");
    let message = messageInput.current.value;
    if (message) {
      console.log(message);
      // Send message
      sendData(message);
      removeFromQueue(currentRoom);
      // Message sent
      messageInput.current.value = "";
    }
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
        removeFromQueue(currentRoom);
      }, 10000);
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
            {/* Profile menu */}
            <List>
              <ListItem button key="profile">
                <ListItemIcon>
                  <Avatar
                    alt={`${user.displayName} profile picture`}
                    src={user.photoURL}
                  />
                </ListItemIcon>
                <ListItemText primary={user.displayName}></ListItemText>
              </ListItem>
            </List>

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
              {/* <Grid container> */}
              <Grid item xs={6} style={{ padding: "10px" }}>
                <Button
                  variant="contained"
                  color="success"
                  aria-label="create-room"
                  fullWidth
                >
                  Create
                </Button>
              </Grid>

              <Grid item xs={6} style={{ padding: "10px" }} align="right">
                <Button
                  variant="contained"
                  color="primary"
                  aria-label="join-room"
                  fullWidth
                >
                  Join
                </Button>
              </Grid>
            </Grid>

            <Divider />

            {/* Rooms that user joined */}
            <List>
              <ListItem button key="Demo">
                <ListItemIcon>
                  <Avatar
                    alt="Demo Room"
                    src="https://material-ui.com/static/images/avatar/1.jpg"
                  />
                </ListItemIcon>
                <ListItemText primary="Demo Room">Demo Room</ListItemText>
                {/* <ListItemText secondary="online" align="right"></ListItemText> */}
              </ListItem>
            </List>
          </Grid>

          <Grid item xs={7}>
            {/**** Message History *****/}
            <List className={classes.messageArea}>
              {messages.map(({ text, author, timestamp }, index) => (
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
