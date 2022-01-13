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
  Fab,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { makeStyles } from "@mui/styles";
import { JanusContext } from "../janus/JanusProvider";
import Message from "../Chats/Message";

const useStyles = makeStyles({
  table: {
    minWidth: 650,
  },
  chatSection: {
    width: "100%",
    height: "80vh",
  },
  headBG: {
    backgroundColor: "#e0e0e0",
  },
  borderRight500: {
    borderRight: "1px solid #e0e0e0",
  },
  messageArea: {
    height: "70vh",
    overflowY: "auto",
  },
});

export default function ChatsLayout() {
  const { currentSession, sendData, messages } = useContext(JanusContext);
  const [sessionId, setSessionId] = useState(0);

  let messageInput = useRef(null);
  const classes = useStyles();

  // TODO remove when accessing database or Janus
  // const [messages, setMessages] = useState([
  //   {
  //     text: "Hey man, What's up?",
  //     author: "Me",
  //     timestamp: "09:30",
  //   },
  //   {
  //     text: "Hey, I am Good! What about you?",
  //     author: "Remy Sharp",
  //     timestamp: "09:31",
  //   },
  //   {
  //     text: "Cool. i am good, let's catch up",
  //     author: "Me",
  //     timestamp: "10:30",
  //   },
  // ]);

  // On componentDidMount
  useEffect(() => {
    console.log("Value", currentSession);
    if (currentSession?.getSessionId())
      setSessionId(currentSession.getSessionId());
  }, [currentSession]);

  useEffect(() => {
    console.log("Chat messages", messages);
  }, [messages]);

  // Send message
  const handleClick = (e) => {
    console.log("Sending message");
    let message = messageInput.current.value;
    console.log(message);
    // Send message
    sendData(message);
    // Message sent
    messageInput.current.value = "";
  };

  return (
    <>
      {/* The current session is{" "}
      {currentSession ? currentSession.getSessionId() : ""} */}
      <div>
        <Grid container>
          <Grid item xs={12}>
            <Typography variant="h5" className="header-message">
              Chat
            </Typography>
          </Grid>
        </Grid>
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
                <ListItem key={index}>
                  <Message author={author} timestamp={timestamp}>
                    {text}
                  </Message>
                </ListItem>
              ))}
            </List>
            <Divider />
            <Grid container style={{ padding: "20px" }}>
              <Grid item xs={11}>
                <TextField
                  id="message-text"
                  placeholder="Enter message"
                  fullWidth
                  inputRef={messageInput}
                />
              </Grid>
              <Grid item xs={1} align="right">
                <Fab color="primary" aria-label="add" onClick={handleClick}>
                  <SendIcon />
                </Fab>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </div>
    </>
  );
}
