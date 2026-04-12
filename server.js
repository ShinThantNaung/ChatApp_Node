const express = require('express');
require('dotenv').config();
const { initSocket } = require('./socket');
const http = require('http');
const cors = require('cors');
const routes = require('./routes');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/', (req, res) => {
    res.send('Server is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
initSocket(server);
