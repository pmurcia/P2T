import { Grid, ListItemText } from "@mui/material";
import Typography from "@mui/material/Typography";
import React, { useContext } from "react";
import { AuthContext } from "../firebase/AuthProvider";

export default function Message({ children, author, timestamp }) {
  //   const user = useContext(AuthContext);
  const user = {
    displayName: "Me",
  };

  let ownMessage = author == user.displayName;

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
        {!ownMessage && (
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
