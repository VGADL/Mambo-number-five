import express from 'express'
import events from "./routes/events.js";
import users from "./routes/users.js";
const app = express()
const port = 3000
app.use(express.json());
app.use("/events", events);
// Load the /users routes
app.use("/users", users);
app.listen(port, () => {
    console.log(`backend listening on port ${port}`)
})
