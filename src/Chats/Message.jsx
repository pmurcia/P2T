import { Grid, ListItemText } from "@mui/material";
import Typography from "@mui/material/Typography";
import React, { useContext } from "react";
import { AuthContext } from "../firebase/AuthProvider";
import { JanusContext } from "../janus/JanusProvider";

export default function Message({ children, author, timestamp }) {
  //   const user = useContext(AuthContext);
  // const { participants } = useContext(JanusContext);
  const user = {
    displayName: "Me",
  };

  const participants = {
    PSu7kew3FO: "Me",
    "36hm0xT1cc": "Remy Sharp",
  };

  let ownMessage = author == user.displayName;
  let enoughParticipants = Object.keys(participants).length >= 3;
  let remoteGroupMessage = !ownMessage && enoughParticipants;

  return (
    <Grid
      container
      direction="column"
      justifyContent="center"
      alignItems={ownMessage ? "flex-end" : "flex-start"}
    >
      <Grid
        item
        style={{
          backgroundColor: ownMessage ? "lightblue" : "lightgrey",
          padding: "0px 10px",
        }}
      >
        {remoteGroupMessage && (
          <ListItemText
            align={ownMessage ? "right" : "left"}
            primary={
              <Typography type="body2" style={{ fontWeight: "bold" }}>
                {author}
              </Typography>
            }
          ></ListItemText>
        )}
        <ListItemText
          align={ownMessage ? "right" : "left"}
          primary={children}
        ></ListItemText>
        <ListItemText
          align={ownMessage ? "right" : "left"}
          secondary={timestamp}
        ></ListItemText>
      </Grid>
    </Grid>
  );
}
