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
  messageArea: {
    height: "80vh",
    overflowY: "auto",
  },
});

export default function ChatsLayout() {
  const { currentSession, sendData, messages, currentRoom } =
    useContext(JanusContext);
  const { user } = useContext(AuthContext);
  const { addToQueue, isMyTurn, removeFromQueue, isOnQueue, roomsInfo } =
    useContext(DatabaseContext);
  const [sessionId, setSessionId] = useState(0);
  const [canTalk, setCanTalk] = useState(false);

  let messageInput = useRef(null);
  let messagesEnd = useRef();

  const classes = useStyles();

  useEffect(() => {
    console.log("UPDATED ROOMS INFO IN CHATS LAYOUT", isMyTurn(currentRoom));
    console.log("ROOMS INFO IN CHATS LAYOUT", { roomsInfo, currentRoom });
    setCanTalk(isMyTurn(currentRoom));
  }, [roomsInfo]);

  useEffect(() => {
    console.log(`CAN${canTalk ? "" : "NOT"} TALK`);
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
    console.log(message);
    // Send message
    sendData(message);
    removeFromQueue(currentRoom);
    // Message sent
    messageInput.current.value = "";
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
    }
  };

  return (
    <>
      {/* The current session is{" "}
      {currentSession ? currentSession.getSessionId() : ""} */}
      <div>
        <Grid container component={Paper} className={classes.chatSection}>
          <Grid item xs={3} className={classes.borderRight500}>
            <List>
              <ListItem button key="RemySharp">
                <ListItemIcon>
                  <Avatar
                    alt="Remy Sharp"
                    src="https://material-ui.com/static/images/avatar/1.jpg"
                  />
                </ListItemIcon>
                <ListItemText primary="John Wick"></ListItemText>
              </ListItem>
            </List>
            <Divider />
            <Grid item xs={12} style={{ padding: "10px" }}>
              <TextField
                id="outlined-basic-email"
                label="Search"
                variant="outlined"
                fullWidth
              />
            </Grid>
            <Divider />
            <List>
              <ListItem button key="RemySharp">
                <ListItemIcon>
                  <Avatar
                    alt="Remy Sharp"
                    src="https://material-ui.com/static/images/avatar/1.jpg"
                  />
                </ListItemIcon>
                <ListItemText primary="Remy Sharp">Remy Sharp</ListItemText>
                <ListItemText secondary="online" align="right"></ListItemText>
              </ListItem>
              <ListItem button key="Alice">
                <ListItemIcon>
                  <Avatar
                    alt="Alice"
                    src="https://material-ui.com/static/images/avatar/3.jpg"
                  />
                </ListItemIcon>
                <ListItemText primary="Alice">Alice</ListItemText>
              </ListItem>
              <ListItem button key="CindyBaker">
                <ListItemIcon>
                  <Avatar
                    alt="Cindy Baker"
                    src="https://material-ui.com/static/images/avatar/2.jpg"
                  />
                </ListItemIcon>
                <ListItemText primary="Cindy Baker">Cindy Baker</ListItemText>
              </ListItem>
            </List>
          </Grid>

          <Grid item xs={9}>
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
                      onClick={handleActivityClick}
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
                    color="primary"
                    aria-label="request-write"
                    onClick={handleActivityClick}
                    fullWidth
                  >
                    Request to talk
                  </Button>
                </>
              )}
            </Grid>
          </Grid>
        </Grid>
      </div>
    </>
  );
}
