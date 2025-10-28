import { MongoClient } from "mongodb";
const connectionString = "mongodb+srv://vgadl_db_user:P2OBiumQApvlhiuN@clusterbola.biyfyk7.mongodb.net/";
const client = new MongoClient(connectionString);
let conn;
try {
 conn = await client.connect();
} catch(e) {
 console.error(e);
}
// Database name
let db = conn.db("ADADProject");
export default db;
