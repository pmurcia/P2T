import {
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import React from "react";

export default function ProfileMenu({ user }) {
  return (
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
  );
}
